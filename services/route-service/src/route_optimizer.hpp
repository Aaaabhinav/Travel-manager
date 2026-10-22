#ifndef ROUTE_OPTIMIZER_HPP
#define ROUTE_OPTIMIZER_HPP

#include <string>
#include <vector>
#include <unordered_map>
#include <cmath>
#include <algorithm>
#include <stdexcept>
#include <iostream>

struct CityCoordinates {
    std::string name;
    double lat;
    double lon;
};

class RouteOptimizer {
private:
    std::unordered_map<std::string, CityCoordinates> cityMap;

    static double toRadians(double degree) {
        return degree * (M_PI / 180.0);
    }

    // Haversine formula to compute distance in Kilometers between two lat/lon pairs
    static double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = toRadians(lat2 - lat1);
        double dLon = toRadians(lon2 - lon1);

        double a = std::sin(dLat / 2.0) * std::sin(dLat / 2.0) +
                   std::cos(toRadians(lat1)) * std::cos(toRadians(lat2)) *
                   std::sin(dLon / 2.0) * std::sin(dLon / 2.0);

        double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
        double R = 6371.0; // Earth radius in km
        return R * c;
    }

    // Convert string to lowercase for case-insensitive comparison
    static std::string toLower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), ::tolower);
        return s;
    }

    /**
     * Resolve a destination name to a canonical city key.
     * Handles DB destination names like "Goa Beaches", "Taj Mahal, Agra",
     * "Kerala Backwaters", "Leh Ladakh", "Andaman Islands" etc.
     *
     * Resolution priority:
     *   1. Exact match
     *   2. Case-insensitive exact match
     *   3. Canonical key is substring of input  ("Goa" found inside "Goa Beaches")
     *   4. Input is substring of canonical key
     */
    std::string resolveCity(const std::string& input) const {
        // 1. Exact match
        if (cityMap.count(input)) return input;

        std::string inputLower = toLower(input);

        // 2. Case-insensitive exact match
        for (const auto& kv : cityMap) {
            if (toLower(kv.first) == inputLower) return kv.first;
        }

        // 3. Canonical key is substring of input  e.g. "Goa" in "Goa Beaches"
        //    Use longest match to avoid "Agra" matching "Kaziranga"
        std::string bestKey;
        size_t bestLen = 0;
        for (const auto& kv : cityMap) {
            std::string keyLower = toLower(kv.first);
            if (inputLower.find(keyLower) != std::string::npos && keyLower.size() > bestLen) {
                bestLen = keyLower.size();
                bestKey = kv.first;
            }
        }
        if (!bestKey.empty()) return bestKey;

        // 4. Input is substring of canonical key
        for (const auto& kv : cityMap) {
            if (toLower(kv.first).find(inputLower) != std::string::npos) return kv.first;
        }

        return ""; // Not resolvable
    }

public:
    RouteOptimizer() {
        // ── All destinations matching the DB seed in infrastructure/postgres/init.sql ──
        // Real GPS coordinates used for accurate Haversine distance computation.

        // Rajasthan
        cityMap["Jaipur"]        = {"Jaipur",        26.9124,  75.7873};
        cityMap["Udaipur"]       = {"Udaipur",        24.5854,  73.7125};
        cityMap["Jodhpur"]       = {"Jodhpur",        26.2389,  73.0243};
        cityMap["Pushkar"]       = {"Pushkar",        26.4899,  74.5512};

        // Uttar Pradesh
        cityMap["Agra"]          = {"Agra",           27.1751,  78.0421};
        cityMap["Varanasi"]      = {"Varanasi",       25.3176,  83.0168};

        // Delhi / NCR
        cityMap["Delhi"]         = {"Delhi",          28.7041,  77.1025};

        // Maharashtra
        cityMap["Mumbai"]        = {"Mumbai",         19.0760,  72.8777};

        // Goa
        cityMap["Goa"]           = {"Goa",            15.2993,  74.1240};

        // Karnataka
        cityMap["Bangalore"]     = {"Bangalore",      12.9716,  77.5946};
        cityMap["Hampi"]         = {"Hampi",          15.3350,  76.4600};
        cityMap["Coorg"]         = {"Coorg",          12.3375,  75.8069};
        cityMap["Mysore"]        = {"Mysore",         12.2958,  76.6394};

        // Kerala
        cityMap["Kerala"]        = {"Kerala",         10.8505,  76.2711};
        cityMap["Munnar"]        = {"Munnar",         10.0889,  77.0595};
        cityMap["Alleppey"]      = {"Alleppey",        9.4981,  76.3388};

        // Tamil Nadu
        cityMap["Ooty"]          = {"Ooty",           11.4102,  76.6950};
        cityMap["Pondicherry"]   = {"Pondicherry",    11.9416,  79.8083};
        cityMap["Auroville"]     = {"Auroville",      12.0055,  79.8083};

        // Himachal Pradesh
        cityMap["Manali"]        = {"Manali",         32.2396,  77.1887};
        cityMap["Shimla"]        = {"Shimla",         31.1048,  77.1734};
        cityMap["Spiti Valley"]  = {"Spiti Valley",   32.2460,  78.0349};

        // Uttarakhand
        cityMap["Rishikesh"]     = {"Rishikesh",      30.0869,  78.2676};
        cityMap["Jim Corbett"]   = {"Jim Corbett",    29.5300,  78.7747};

        // Ladakh (UT) — "Leh Ladakh" resolves here via fuzzy match
        cityMap["Ladakh"]        = {"Ladakh",         34.1526,  77.5771};
        cityMap["Leh"]           = {"Leh",            34.1526,  77.5771};

        // Gujarat
        cityMap["Ahmedabad"]     = {"Ahmedabad",      23.0225,  72.5714};
        cityMap["Rann of Kutch"] = {"Rann of Kutch",  23.7337,  69.8597};

        // West Bengal
        cityMap["Kolkata"]       = {"Kolkata",        22.5726,  88.3639};
        cityMap["Darjeeling"]    = {"Darjeeling",     27.0360,  88.2627};

        // Andaman & Nicobar — "Andaman Islands" resolves here
        cityMap["Andaman"]       = {"Andaman",        11.7401,  92.6586};
        cityMap["Port Blair"]    = {"Port Blair",     11.6234,  92.7265};

        // Punjab
        cityMap["Amritsar"]      = {"Amritsar",       31.6340,  74.8723};

        // Assam
        cityMap["Kaziranga"]     = {"Kaziranga",      26.5775,  93.1711};
    }

    bool hasCity(const std::string& city) const {
        return !resolveCity(city).empty();
    }

    // Nearest Neighbor TSP Heuristic — O(n^2), good enough for up to ~20 cities
    void optimizeRoute(const std::string& source,
                       const std::vector<std::string>& destinations,
                       std::vector<std::string>& outRoute,
                       double& outDistance,
                       int& outTravelTimeHours) const {

        std::string resolvedSource = resolveCity(source);
        if (resolvedSource.empty()) {
            throw std::invalid_argument(
                "Unknown source city: '" + source +
                "'. Supported cities: Ahmedabad, Agra, Alleppey, Amritsar, Andaman, "
                "Auroville, Bangalore, Coorg, Darjeeling, Delhi, Goa, Hampi, Jaipur, "
                "Jim Corbett, Kaziranga, Kerala, Kolkata, Ladakh, Manali, Mumbai, "
                "Munnar, Mysore, Ooty, Pondicherry, Pushkar, Rann of Kutch, Rishikesh, "
                "Shimla, Spiti Valley, Udaipur, Varanasi, Jodhpur."
            );
        }

        std::vector<std::string> unvisited;
        for (const auto& dest : destinations) {
            std::string resolved = resolveCity(dest);
            if (resolved.empty()) {
                throw std::invalid_argument(
                    "Unknown destination: '" + dest + "'. Could not match to a known Indian city."
                );
            }
            if (resolved != resolvedSource) {
                bool alreadyAdded = false;
                for (const auto& u : unvisited) {
                    if (u == resolved) { alreadyAdded = true; break; }
                }
                if (!alreadyAdded) unvisited.push_back(resolved);
            }
        }

        outRoute.clear();
        outRoute.push_back(resolvedSource);
        outDistance = 0.0;

        std::string current = resolvedSource;
        while (!unvisited.empty()) {
            double minDist = 1e9;
            int bestIdx = -1;

            const auto& currCoords = cityMap.at(current);
            for (size_t i = 0; i < unvisited.size(); ++i) {
                const auto& targetCoords = cityMap.at(unvisited[i]);
                double d = haversineDistance(
                    currCoords.lat, currCoords.lon,
                    targetCoords.lat, targetCoords.lon
                );
                if (d < minDist) {
                    minDist = d;
                    bestIdx = static_cast<int>(i);
                }
            }

            if (bestIdx != -1) {
                outDistance += minDist;
                current = unvisited[bestIdx];
                outRoute.push_back(current);
                unvisited.erase(unvisited.begin() + bestIdx);
            }
        }

        // Average road travel speed ~ 60 km/h
        outTravelTimeHours = static_cast<int>(std::round(outDistance / 60.0));
        outDistance = std::round(outDistance * 10.0) / 10.0;
    }
};

#endif
