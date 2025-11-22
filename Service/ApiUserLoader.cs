using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentResults;
using Microsoft.Extensions.Configuration;
using RestSharp;

namespace TaskManagement.Service
{
    // Injectable wrapper to load users from API using configuration (similar to ApiDepartmentLoad)
    public class ApiUserLoader
    {
        private readonly IConfiguration _configuration;

        public ApiUserLoader(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<Result<List<T>>> GetApiListDataAsync<T>()
        {
            try
            {
                var baseUrl = _configuration["ConnectionStrings:ApiUserUrl"];
                var ApiSecureHeaderKey = _configuration["ConnectionStrings:IndexerApiSecureHeaderKey"];
                var accessKey = _configuration["ConnectionStrings:ApiAccessKey"]; 

                var fullUrl = baseUrl;
                if (!string.IsNullOrWhiteSpace(accessKey))
                {
                    // append access key as query if required; callers can configure URL differently
                    fullUrl = baseUrl.Contains("?") ? $"{baseUrl}&accessKey={accessKey}" : $"{baseUrl}?accessKey={accessKey}";
                }

                var client = new RestClient();
                var request = new RestRequest(fullUrl, Method.Get);
                request.AddHeader("X-Api-Key",ApiSecureHeaderKey);
                var response = await client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    if (!string.IsNullOrWhiteSpace(response.Content))
                    {
                        var data = Newtonsoft.Json.JsonConvert.DeserializeObject<List<T>>(response.Content);
                        return Result.Ok(data);
                    }
                    return Result.Fail("No content in response.");
                }
                else
                {
                    return Result.Fail(response.ErrorMessage ?? "Request failed.");
                }
            }
            catch (Exception ex)
            {
                return Result.Fail($"An error occurred: {ex.Message}");
            }
        }
    }
}
