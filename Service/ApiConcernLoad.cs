using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentResults;
using RestSharp;

namespace TaskManagement.Service
{
    public class ApiConcernLoad
    {
        private readonly IConfiguration _configuration;

        public ApiConcernLoad(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<Result<List<T>>> GetApiListDataAsync<T>()
        {
            try
            {
                // Read values from appsettings.json
                var baseUrl = _configuration["ConnectionStrings:ApiConcernUrl"];
                var accessKey = _configuration["ConnectionStrings:ApiAccessKey"];

                // Append access key to URL
                var fullUrl = $"{baseUrl}?accessKey={accessKey}";

                var client = new RestClient();
                var request = new RestRequest(fullUrl, Method.Get);

                var response = await client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    if (!string.IsNullOrWhiteSpace(response.Content))
                    {
                        var data = Newtonsoft.Json.JsonConvert.DeserializeObject<List<T>>(
                            response.Content
                        );
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
