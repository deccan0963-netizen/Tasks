using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using RestSharp;
using TaskManagement.Data;
using TaskManagement.Filters;
using TaskManagement.Models;
using TaskManagement.Models.Enums;
using TaskManagement.Models.GlobalData;
using TaskManagement.Service;

namespace TaskManagement.Controllers
{
    public class ManageTasksController : Controller
    {
        private readonly TaskManagementContext _context;
        private readonly ApiDepartmentLoad _apiDepartmentLoad;
        private readonly ApiUserLoader _apiUserLoader;

        public ManageTasksController(
            TaskManagementContext context,
            ApiDepartmentLoad apiDepartmentLoad,
            ApiUserLoader apiUserLoader
        )
        {
            _context = context;
            _apiDepartmentLoad = apiDepartmentLoad;
            _apiUserLoader = apiUserLoader;
        }

        // [PermissionFilter("Task", "View")]
        public async Task<IActionResult> Index()
        {
            try
            {
                if (GlobalUserData.globalUserList == null || !GlobalUserData.globalUserList.Any())
                {
                    var result = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
                    if (result.IsSuccess)
                        GlobalUserData.globalUserList = result.Value;
                    else
                        GlobalUserData.globalUserList = new List<ApiUserDto>();
                }

                var usersResult = GlobalUserData.globalUserList;

                var projects = await _context
                    .Projects.Where(p => p.IsDeleted == "N" && p.IsDisabled == "N")
                    .OrderByDescending(p => p.CreatedTime)
                    .ToListAsync();

                var deptResult = await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>();
                var departments = deptResult.IsSuccess ? deptResult.Value : new List<ApiDeptDto>();

                ViewBag.Users = usersResult;
                ViewBag.Projects = projects;
                ViewBag.Departments = departments;
                // ViewBag.ProjectEnum = typeof(ProjectEnum);
                ViewBag.StatusEnum = typeof(StatusEnum);

                var Permessionsresult = await GetRolePermessions(4);
                
                if (!Permessionsresult.IsSuccess)
                {
                    return View("Error");
                }

                GlobalUserData.globalRolePermessionList = Permessionsresult.IsSuccess
                    ? Permessionsresult.Value
                    : new List<RolePermessionDto>();

                    ViewBag.RolePermessions = GlobalUserData.globalRolePermessionList;

                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Users = new List<ApiUserDto>();
                ViewBag.Projects = new List<ProjectBo>();
                ViewBag.Departments = new List<ApiDeptDto>();
                ViewBag.ErrorMessage = ex.Message;
                return View("Error");
            }
        }

        private async Task<Result<List<RolePermessionDto>>> GetRolePermessions(int RoleId)
        {
            try
            {
                var client = new RestClient("http://sky:3939/api/");
                var request = new RestRequest(
                    $"Privilege/Get-privileges-By-Role-Id?roleId={RoleId}",
                    Method.Get
                );
                request.AddHeader("X-Api-Key", "IDX-STATIC-KEY-PROD-7hR@Zx4!Fp8q%Yc2n#Lb3Tk9Vw");

                var response = await client.ExecuteAsync(request);

                if (response.IsSuccessful)
                {
                    var rolePermessions = JsonConvert.DeserializeObject<List<RolePermessionDto>>(
                        response.Content
                    );
                    return Result.Ok(rolePermessions);
                }
                else
                {
                    return Result.Fail<List<RolePermessionDto>>(
                        "Error fetching role permissions: " + response.Content
                            ?? response.StatusDescription
                    );
                }
            }
            catch (Exception ex)
            {
                return Result.Fail<List<RolePermessionDto>>(
                    "An error occurred while fetching role permissions: " + ex.Message
                );
            }
        }
    }
}
