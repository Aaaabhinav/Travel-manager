cmake_minimum_required(VERSION 3.14)
project(route_service CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src)

find_path(HIREDIS_INCLUDE_DIR hiredis/hiredis.h)
find_library(HIREDIS_LIBRARY hiredis)

include_directories(${HIREDIS_INCLUDE_DIR})

add_executable(route-service src/main.cpp)

target_link_libraries(route-service PRIVATE ${HIREDIS_LIBRARY} pthread)
