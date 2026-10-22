#ifndef REDIS_CLIENT_HPP
#define REDIS_CLIENT_HPP

#include <string>
#include <iostream>
#include <hiredis/hiredis.h>

class RedisCache {
private:
    std::string host;
    int port;
    redisContext* context;

public:
    RedisCache(const std::string& host, int port) : host(host), port(port), context(nullptr) {
        connect();
    }

    ~RedisCache() {
        if (context) {
            redisFree(context);
        }
    }

    void connect() {
        context = redisConnect(host.c_str(), port);
        if (context && context->err) {
            std::cerr << "[RedisCache] Connection error: " << context->errstr << std::endl;
            redisFree(context);
            context = nullptr;
        } else if (context) {
            std::cout << "[RedisCache] Connected to Redis at " << host << ":" << port << std::endl;
        }
    }

    std::string get(const std::string& key) {
        if (!context) {
            connect();
        }
        if (!context) return "";

        redisReply* reply = (redisReply*)redisCommand(context, "GET %s", key.c_str());
        if (!reply) return "";

        std::string result = "";
        if (reply->type == REDIS_REPLY_STRING) {
            result = reply->str;
        }
        freeReplyObject(reply);
        return result;
    }

    bool setEx(const std::string& key, int ttlSeconds, const std::string& value) {
        if (!context) {
            connect();
        }
        if (!context) return false;

        redisReply* reply = (redisReply*)redisCommand(context, "SETEX %s %d %s", key.c_str(), ttlSeconds, value.c_str());
        bool success = (reply && reply->type == REDIS_REPLY_STATUS && std::string(reply->str) == "OK");
        if (reply) freeReplyObject(reply);
        return success;
    }
};

#endif
