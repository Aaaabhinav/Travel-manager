package com.travel.userservice.dto;

import lombok.Data;

@Data
public class UpdateUserRequest {
    private String fullName;
    private String phone;
    private String homeCity;
    private String travelPreferences;
    private String avatarUrl;
}
