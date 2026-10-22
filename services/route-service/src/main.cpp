#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
#include <cstdlib>
#include <nlohmann/json.hpp>
#include "httplib.h"
#include "route_optimizer.hpp"
#include "redis_client.hpp"

using json = nlohmann::json;

int main() {
    const char* portEnv = std::getenv("PORT");
    int port = portEnv ? std::atoi(portEnv) : 8085;

    const char* redisHostEnv = std::getenv("REDIS_HOST");
    std::string redisHost = redisHostEnv ? redisHostEnv : "redis";

    const char* redisPortEnv = std::getenv("REDIS_PORT");
    int redisPort = redisPortEnv ? std::atoi(redisPortEnv) : 6379;

    RouteOptimizer optimizer;
    RedisCache redisCache(redisHost, redisPort);

    httplib::Server svr;

    // Health check endpoint
    auto healthHandler = [](const httplib::Request&, httplib::Response& res) {
        json j = {
            {"status", "UP"},
            {"service", "route-service"},
            {"cache", "redis"}
        };
        res.set_content(j.dump(), "application/json");
    };

    svr.Get("/health", healthHandler);
    svr.Get("/api/routes/health", healthHandler);

    // Route optimize endpoint
    auto optimizeHandler = [&](const httplib::Request& req, httplib::Response& res) {
        try {
            auto bodyJson = json::parse(req.body);

            if (!bodyJson.contains("source") || !bodyJson.contains("destinations")) {
                res.status = 400;
                res.set_content(json({{"error", "Missing 'source' or 'destinations' in request body"}}).dump(), "application/json");
                return;
            }

            std::string source = bodyJson["source"].get<std::string>();
            std::vector<std::string> destinations = bodyJson["destinations"].get<std::vector<std::string>>();

            // Create Redis cache key
            std::vector<std::string> sortedDests = destinations;
            std::sort(sortedDests.begin(), sortedDests.end());
            std::string cacheKey = "route:" + source;
            for (const auto& d : sortedDests) {
                cacheKey += ":" + d;
            }

            // Check cache
            std::string cachedRes = redisCache.get(cacheKey);
            if (!cachedRes.empty()) {
                try {
                    json cj = json::parse(cachedRes);
                    cj["cached"] = true;
                    res.set_content(cj.dump(), "application/json");
                    return;
                } catch (...) {}
            }

            std::vector<std::string> route;
            double totalDistance = 0.0;
            int travelTime = 0;

            optimizer.optimizeRoute(source, destinations, route, totalDistance, travelTime);

            json responseJson = {
                {"optimizedRoute", route},
                {"totalDistance", totalDistance},
                {"estimatedTravelTime", travelTime},
                {"cached", false}
            };

            // Store in Redis (TTL 3600 seconds)
            redisCache.setEx(cacheKey, 3600, responseJson.dump());

            res.set_content(responseJson.dump(), "application/json");

        } catch (const std::invalid_argument& e) {
            res.status = 400;
            res.set_content(json({{"error", e.what()}}).dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json({{"error", e.what()}}).dump(), "application/json");
        }
    };

    svr.Post("/optimize", optimizeHandler);
    svr.Post("/routes/optimize", optimizeHandler);
    svr.Post("/api/routes/optimize", optimizeHandler);

    std::cout << "[RouteService] C++ Route Optimization Service running on port " << port << "..." << std::endl;
    svr.listen("0.0.0.0", port);

    return 0;
}
