package com.example.numberbetting.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("/api/user/profile")
    suspend fun getUserProfile(): UserProfileResponse

    @POST("/api/game/bet")
    suspend fun placeBet(@Body request: PlaceBetRequest): PlaceBetResponse
    
    @GET("/api/game/current-draw")
    suspend fun getCurrentDraw(): DrawResponse
}

// Data Classes for Requests and Responses
data class LoginRequest(val identifier: String, val password: String)
data class LoginResponse(val token: String, val name: String, val wallet_balance: Double)
data class UserProfileResponse(val name: String, val wallet_balance: Double, val email: String)
data class PlaceBetRequest(val draw_id: String, val number: Int, val bet_amount: Double)
data class PlaceBetResponse(val _id: String, val status: String, val potential_payout: Double)
data class DrawResponse(val _id: String, val draw_time: String, val status: String)
