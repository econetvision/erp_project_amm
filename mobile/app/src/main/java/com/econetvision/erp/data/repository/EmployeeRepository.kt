package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.Employee
import com.econetvision.erp.data.model.PaginatedEmployees

class EmployeeRepository {
    private val api = RetrofitClient.instance

    suspend fun getEmployees(page: Int = 1, query: String? = null): Result<PaginatedEmployees> {
        return try {
            val response = api.getEmployees(page = page, query = query)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to load employees"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getEmployee(id: Int): Result<Employee> {
        return try {
            val response = api.getEmployee(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Employee not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
