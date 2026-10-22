#ifndef REDIS_CLIENT_HPP
#define REDIS_CLIENT_HPP

#include <string>
#include <iostream>
// The official, lightweight C client library for interacting with Redis.
#include <hiredis/hiredis.h> 

class RedisCache {
private:
    std::string host;
    int port;
    // context is a pointer to a redisContext struct from hiredis, which maintains the active TCP connection state to Redis.
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
        // Opens a TCP connection to the Redis server using hiredis.
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

        // Sends a standard Redis GET command to fetch the value associated with the key.
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
        // Executes Redis's Set with Expiry command (SETEX), which sets a key-value pair along with a Time-To-Live (TTL) in seconds.
        redisReply* reply = (redisReply*)redisCommand(context, "SETEX %s %d %s", key.c_str(), ttlSeconds, value.c_str());
        bool success = (reply && reply->type == REDIS_REPLY_STATUS && std::string(reply->str) == "OK");
        if (reply) freeReplyObject(reply);
        return success;
    }
};

#endif
