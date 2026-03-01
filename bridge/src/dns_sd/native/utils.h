#ifndef DNS_SD_UTILS_H_
#define DNS_SD_UTILS_H_

#include <cstdio>
#include <string>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#endif

/** Defer-cleanup util class. */
template <typename F> struct [[nodiscard]] ScopeGuard {
    F fn;
    ~ScopeGuard() { fn(); }
};

#ifdef DNS_SD_DEBUG
#define DEBUG_LOG(fmt, ...) std::fprintf(stderr, "[dns_sd] " fmt "\n", ##__VA_ARGS__)
#else
#define DEBUG_LOG(fmt, ...) ((void)0)
#endif

#define ERROR_LOG(fmt, ...) std::fprintf(stderr, "[dns_sd] " fmt "\n", ##__VA_ARGS__)

/** Resolves a hostname to IPv4/v6 address strings via getaddrinfo. */
inline void resolve_addresses(
    const std::string& hostname, std::string& out_ipv4, std::string& out_ipv6)
{
    addrinfo hints { .ai_family = AF_UNSPEC, .ai_socktype = SOCK_STREAM };
    addrinfo* result = nullptr;
    if (getaddrinfo(hostname.c_str(), nullptr, &hints, &result) != 0)
        return;

    for (addrinfo* p = result; p; p = p->ai_next) {
        if (p->ai_family == AF_INET && out_ipv4.empty()) {
            char buf[INET_ADDRSTRLEN];
            auto* addr = reinterpret_cast<sockaddr_in*>(p->ai_addr);
            if (inet_ntop(AF_INET, &addr->sin_addr, buf, sizeof(buf)))
                out_ipv4 = buf;
        } else if (p->ai_family == AF_INET6 && out_ipv6.empty()) {
            char buf[INET6_ADDRSTRLEN];
            auto* addr = reinterpret_cast<sockaddr_in6*>(p->ai_addr);
            if (inet_ntop(AF_INET6, &addr->sin6_addr, buf, sizeof(buf)))
                out_ipv6 = buf;
        }
    }
    freeaddrinfo(result);
}

#endif // DNS_SD_UTILS_H_
