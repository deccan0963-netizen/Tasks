using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Newtonsoft.Json;
using RestSharp;
using TaskManagement.Filters;
using TaskManagement.Interfaces;
using TaskManagement.Models;
using TaskManagement.Models.Enums;
using TaskManagement.Service;

namespace TaskManagement.Controllers
{
    public class TaskController : BaseController
    {
        private readonly ITaskInterface _taskRepo;
        private readonly IProjectInterface _projectRepo;
        private readonly ApiDepartmentLoad _apiDepartmentLoad;
        private readonly ApiUserLoader _apiUserLoader;

        public TaskController(
            ITaskInterface taskRepo,
            IProjectInterface projectRepo,
            ApiDepartmentLoad apiDepartmentLoad,
            ApiUserLoader apiUserLoader
        )
        {
            _taskRepo = taskRepo;
            _projectRepo = projectRepo;
            _apiDepartmentLoad = apiDepartmentLoad;
            _apiUserLoader = apiUserLoader;
        }

        [PermissionFilter("Task", "View")]
        [HttpGet]
        public async Task<IActionResult> Index()
        {
            try
            {
                // Load tasks
                ViewBag.RolePermessions = await GetRolePermessions();
                var taskResult = await _taskRepo.GetAllAsync();
                var allTasks = taskResult.Value ?? new List<TaskBo>();

                // Load departments
                var deptResult = await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>();
                var departments = deptResult.IsSuccess ? deptResult.Value : new List<ApiDeptDto>();

                // Load all projects including completed ones
                var projectResult = await _projectRepo.GetAllIncludingCompletedAsync();
                var projects = projectResult.IsSuccess
                    ? projectResult.Value
                    : new List<ProjectBo>();

                // Department lookup
                ViewBag.DepartmentLookup = departments
                    .GroupBy(d => d.SectionId)
                    .ToDictionary(g => g.Key, g => g.First().SectionName);

                // Project lookup
                ViewBag.ProjectLookup = projects
                    .GroupBy(p => p.Id)
                    .ToDictionary(g => g.Key, g => g.First().ProjectName.ToString());
                // Load users
                var userResult = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
                ViewBag.Users = userResult.IsSuccess ? userResult.Value : new List<ApiUserDto>();

                ViewBag.UsersLookup =
                    (userResult.IsSuccess && userResult.Value != null)
                        ? userResult.Value.ToDictionary(u => u.id, u => u.userName)
                        : new Dictionary<int, string>();

                return View(allTasks);
            }
            catch
            {
                ViewBag.DepartmentLookup = new Dictionary<int, string>();
                ViewBag.ProjectLookup = new Dictionary<int, string>();
                return View(new List<TaskBo>());
            }
        }

        [PermissionFilter("task", "Create-Update")]
        [HttpGet]
        public async Task<IActionResult> Create()
        {
            try
            {
                // Load departments
                var deptResult = await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>();
                ViewBag.Departments = deptResult.IsSuccess
                    ? deptResult.Value
                    : new List<ApiDeptDto>();

                // Load users
                var userResult = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
                ViewBag.Users = userResult.IsSuccess ? userResult.Value : new List<ApiUserDto>();

                // Load all projects including completed
                var projectResult = await _projectRepo.GetAllIncludingCompletedAsync();
                var projects = projectResult.IsSuccess
                    ? projectResult.Value
                    : new List<ProjectBo>();

                ViewBag.Projects = projects
                    .Select(p => new SelectListItem
                    {
                        Value = p.Id.ToString(),
                        Text = p.ProjectName,
                    })
                    .ToList();

                // Project list for dropdown
                ViewBag.Projects = projects
                    .Where(p => !string.IsNullOrWhiteSpace(p.ProjectName)) // FILTER nulls
                    .Select(p => new SelectListItem
                    {
                        Value = p.Id.ToString(),
                        Text = p.ProjectName,
                    })
                    .ToList();

                ViewBag.RolePermessions = await GetRolePermessions();
                return View(new TaskBo());
            }
            catch
            {
                ViewBag.Departments = new List<ApiDeptDto>();
                ViewBag.Users = new List<ApiUserDto>();
                ViewBag.Projects = new List<dynamic>();
                return View(new TaskBo());
            }
        }

        [PermissionFilter("task", "Create-Update")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<JsonResult> Create(TaskBo model, List<int> SelectedUserNames)
        {
            try
            {
                model.AssignedBy = GetCurrentUserName();
                model.SelectedUserNames = SelectedUserNames ?? new List<int>();
                model.AssignedUsers = string.Join(",", model.SelectedUserNames);

                model.DueDate = DateTime.SpecifyKind(model.DueDate, DateTimeKind.Utc);

                if (model.Status == StatusEnum.Completed)
                    model.CompletedDate = DateTime.UtcNow;

                SetCreatedFields(model);

                var response = await _taskRepo.AddAsync(model);
                if (response.IsFailed)
                    return Json(
                        new
                        {
                            success = false,
                            errors = response.Errors.Select(x => x.Message).ToList(),
                        }
                    );

                return Json(new { success = true, data = response.Value });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, errors = new[] { ex.Message } });
            }
        }

        [PermissionFilter("task", "Create-Update")]
        [HttpGet]
        public async Task<IActionResult> Edit(int id)
        {
            try
            {
                var taskResult = await _taskRepo.GetByIdAsync(id);
                if (taskResult.IsFailed)
                    return NotFound();

                ViewBag.Departments =
                    (await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>()).Value
                    ?? new List<ApiDeptDto>();
                ViewBag.Users =
                    (await _apiUserLoader.GetApiListDataAsync<ApiUserDto>()).Value
                    ?? new List<ApiUserDto>();

                // Load all projects including completed
                var projectResult = await _projectRepo.GetAllIncludingCompletedAsync();
                var projects = projectResult.IsSuccess
                    ? projectResult.Value
                    : new List<ProjectBo>();

                ViewBag.Projects = projects
                    .Where(p => !string.IsNullOrWhiteSpace(p.ProjectName))
                    .Select(p => new SelectListItem
                    {
                        Value = p.Id.ToString(),
                        Text = $" {p.ProjectName}",
                    })
                    .ToList();

                ViewBag.RolePermessions = await GetRolePermessions();
                return View(taskResult.Value);
            }
            catch
            {
                return NotFound();
            }
        }

        [PermissionFilter("task", "Create-Update")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<JsonResult> Edit(TaskBo model, List<int> SelectedUserNames)
        {
            try
            {
                model.AssignedBy = GetCurrentUserName();
                model.SelectedUserNames = SelectedUserNames ?? new List<int>();
                model.AssignedUsers = string.Join(",", model.SelectedUserNames);
                model.DueDate = DateTime.SpecifyKind(model.DueDate, DateTimeKind.Utc);

                if (model.Status == StatusEnum.Completed)
                {
                    if (!model.CompletedDate.HasValue)
                        model.CompletedDate = DateTime.UtcNow;
                    else
                        model.CompletedDate = DateTime.SpecifyKind(
                            model.CompletedDate.Value,
                            DateTimeKind.Utc
                        );
                }

                var response = await _taskRepo.UpdateAsync(model);
                if (response.IsFailed)
                    return Json(
                        new { success = false, errors = response.Errors.Select(x => x.Message) }
                    );

                return Json(new { success = true, data = response.Value });
            }
            catch (Exception ex)
            {
                string inner = ex.InnerException?.Message ?? ex.Message;
                return Json(new { success = false, errors = new[] { inner } });
            }
        }

        [PermissionFilter("Task", "Delete")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<JsonResult> Delete(int id)
        {
            try
            {
                var response = await _taskRepo.DeleteAsync(id);
                if (response.IsFailed)
                    return Json(
                        new { success = false, errors = response.Errors.Select(x => x.Message) }
                    );

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, errors = new[] { ex.Message } });
            }
        }

        private async Task<List<RolePermessionDto>> GetRolePermessions()
        {
            var client = new RestClient("http://sky:3939/api/");
            var request = new RestRequest(
                "Privilege/Get-privileges-By-Role-Id?roleId=4",
                Method.Get
            );
            request.AddHeader("X-Api-Key", "IDX-STATIC-KEY-PROD-7hR@Zx4!Fp8q%Yc2n#Lb3Tk9Vw");

            var response = await client.ExecuteAsync(request);

            if (!response.IsSuccessful)
                return new List<RolePermessionDto>();

            return JsonConvert.DeserializeObject<List<RolePermessionDto>>(response.Content)
                ?? new List<RolePermessionDto>();
        }
    }
}
