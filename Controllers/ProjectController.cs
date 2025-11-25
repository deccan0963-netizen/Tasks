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
using TaskManagement.Models.GlobalData;
using TaskManagement.Service;

namespace TaskManagement.Controllers
{
    public class ProjectController : BaseController
    {
        private readonly IProjectInterface _projectRepo;
        private readonly ITaskAcceptanceInterface _taskAcceptanceRepo;
        private readonly ApiDepartmentLoad _apiDepartmentLoad;
        private readonly ApiUserLoader _apiUserLoader;
        private ApiConcernLoad _apiConcernLoad;
        private readonly ITaskInterface _taskRepo;

        public ProjectController(
            IProjectInterface projectRepo,
            ITaskInterface taskRepo,
            ITaskAcceptanceInterface taskAcceptanceRepo,
            ApiDepartmentLoad apiDepartmentLoad,
            ApiUserLoader apiUserLoader,
            ApiConcernLoad apiConcernLoad
        )
        {
            _projectRepo = projectRepo;
            _taskRepo = taskRepo;
            _taskAcceptanceRepo = taskAcceptanceRepo;
            _apiDepartmentLoad = apiDepartmentLoad;
            _apiUserLoader = apiUserLoader;
            _apiConcernLoad = apiConcernLoad;
        }

        [PermissionFilter("Project", "View")]
        public async Task<IActionResult> Index()
        {
            try
            {
                if (
                    GlobalUserData.globalUserList == null
                    || !GlobalUserData.globalUserList.Any()
                    || GlobalUserData.LastLoadedTime == null
                    || (DateTime.UtcNow - GlobalUserData.LastLoadedTime.Value).TotalHours > 24
                )
                {
                    var userResult = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
                    GlobalUserData.globalUserList = userResult.IsSuccess
                        ? userResult.Value
                        : new List<ApiUserDto>();
                    GlobalUserData.LastLoadedTime = DateTime.UtcNow;
                }

                if (
                    GlobalDeptData.globalDeptList == null
                    || !GlobalDeptData.globalDeptList.Any()
                    || GlobalDeptData.LastLoadedTime == null
                    || (DateTime.UtcNow - GlobalDeptData.LastLoadedTime.Value).TotalHours > 24
                )
                {
                    var deptResult = await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>();
                    GlobalDeptData.globalDeptList = deptResult.IsSuccess
                        ? deptResult.Value
                        : new List<ApiDeptDto>();
                    GlobalDeptData.LastLoadedTime = DateTime.UtcNow;
                }

                var users = GlobalUserData.globalUserList ?? new List<ApiUserDto>();
                var departments = GlobalDeptData.globalDeptList ?? new List<ApiDeptDto>();
                ViewBag.DepartmentLookup = departments
                    .GroupBy(d => d.SectionId)
                    .ToDictionary(g => g.Key, g => g.First().SectionName);
                var concernResult = await _apiConcernLoad.GetApiListDataAsync<ApiConcernDto>();
                var concerns = concernResult.IsSuccess
                    ? concernResult.Value
                    : new List<ApiConcernDto>();

                ViewBag.ConcernLookup = concerns.ToDictionary(c => c.ConcernId, c => c.ConcernName);
                ViewBag.Concern = concerns;

                var projectResult = await _projectRepo.GetAllAsync();
                var projectList = projectResult.Value ?? new List<ProjectBo>();

                ViewBag.Users = users;
                ViewBag.Departments = departments;
                ViewBag.Concern = concerns;

                ViewBag.RolePermessions = await GetRolePermessions();
                return View(projectList);
            }
            catch (Exception ex)
            {
                ViewBag.Users = new List<ApiUserDto>();
                ViewBag.Departments = new List<ApiDeptDto>();
                ViewBag.Concern = new List<ApiConcernDto>();
                ViewBag.ErrorMessage = ex.Message;
                return View(new List<ProjectBo>());
            }
        }

        [PermissionFilter("Project", "Create-Update")]
        [HttpGet]
        public async Task<IActionResult> Create()
        {
            var userResult = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
            var deptResult = await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>();
            var concernResult = await _apiConcernLoad.GetApiListDataAsync<ApiConcernDto>();

            ViewBag.Users = userResult.IsSuccess ? userResult.Value : new List<ApiUserDto>();
            ViewBag.Departments = deptResult.IsSuccess ? deptResult.Value : new List<ApiDeptDto>();
            ViewBag.Concern = concernResult.IsSuccess
                ? concernResult.Value
                : new List<ApiConcernDto>();
            ViewBag.RolePermessions = await GetRolePermessions();

            return View(new ProjectBo());
        }

        [PermissionFilter("Project", "Create-Update")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<JsonResult> Create(ProjectBo model, List<int> SelectedUserNames)
        {
            try
            { 
               

                var response = await _projectRepo.AddAsync(
                    model
                );
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
                return Json(new { success = false, errors = new List<string> { ex.Message } });
            }
        }

        [PermissionFilter("Project", "Create-Update")]
        [HttpGet]
        public async Task<IActionResult> Edit(int id)
        {
            var projectResult = await _projectRepo.GetByIdAsync(id);
            if (projectResult.IsFailed)
                return NotFound();

            var project = projectResult.Value;
            project.SelectedUserNames ??= new List<int>();
            var userResult = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
            var deptResult = await _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>();
            var concernResult = await _apiConcernLoad.GetApiListDataAsync<ApiConcernDto>();

            ViewBag.Users = userResult.IsSuccess ? userResult.Value : new List<ApiUserDto>();
            ViewBag.Departments = deptResult.IsSuccess ? deptResult.Value : new List<ApiDeptDto>();
            if (concernResult.IsSuccess)
            {
                ViewBag.Concerns = concernResult
                    .Value.Select(c => new SelectListItem
                    {
                        Value = c.ConcernId.ToString(),
                        Text = c.ConcernName,
                    })
                    .ToList();
            }
            else
            {
                ViewBag.Concerns = new List<SelectListItem>();
            }

            ViewBag.RolePermessions = await GetRolePermessions();

            return View(project);
        }

        [PermissionFilter("Project", "Create-Update")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<JsonResult> Edit(ProjectBo model, List<int> SelectedUserNames)
        {
            try
            {
                model.AssignedBy = model.AssignedBy?.Trim();

                var response = await _projectRepo.UpdateAsync(
                    model,
                    SelectedUserNames ?? new List<int>()
                );
                if (response.IsFailed)
                    return Json(
                        new { success = false, errors = response.Errors.Select(x => x.Message) }
                    );

                return Json(new { success = true, data = response.Value });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, errors = new[] { ex.Message } });
            }
        }

        [PermissionFilter("Project", "Delete")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<JsonResult> Delete(int id)
        {
            try
            {
                var response = await _projectRepo.DeleteAsync(id);
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
            var api = new RestClient("http://sky:3939/api/");
            var request = new RestRequest(
                "Privilege/Get-privileges-By-Role-Id?roleId=4",
                Method.Get
            );
            request.AddHeader("X-Api-Key", "IDX-STATIC-KEY-PROD-7hR@Zx4!Fp8q%Yc2n#Lb3Tk9Vw");

            var response = await api.ExecuteAsync(request);

            if (!response.IsSuccessful)
                return new List<RolePermessionDto>();

            return JsonConvert.DeserializeObject<List<RolePermessionDto>>(response.Content)
                ?? new List<RolePermessionDto>();
        }

        // [PermissionFilter("Project", "View")]
        [HttpGet]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var projectResult = await _projectRepo.GetByIdAsync(id);
            if (projectResult.IsFailed || projectResult.Value == null)
                return Json(new { success = false, error = "Project not found." });

            var project = projectResult.Value;

            var deptName =
                GlobalDeptData
                    .globalDeptList?.FirstOrDefault(d => d.SectionId == project.Department)
                    ?.SectionName ?? "N/A";
            var assignedUsers = project.SelectedUserNames ?? new List<int>();

            var tasks = new List<object>();
            if (_taskRepo != null)
            {
                var taskList = await _taskRepo.GetTasksByProjectId(project.Id);
                tasks = taskList
                    .Select(t => new
                    {
                        id = t.Id,
                        title = t.TaskName,
                        assignedUser = t.SelectedUserNames.FirstOrDefault() ?? "N/A",
                        assignedUsers = t.SelectedUserNames ?? new List<string>(),
                        assignedBy = t.AssignedBy ?? "N/A",
                        status = (int)t.Status,
                        description = t.Description ?? "No Description / Requirements",
                        dueDate = t.DueDate.ToString("dd/MM/yyyy"),
                        completedDate = t.CompletedDate?.ToString("dd/MM/yyyy") ?? "N/A",
                        assignedDate = t.CreatedTime?.ToString("dd/MM/yyyy") ?? "N/A",
                    })
                    .ToList<object>();
            }

            var acceptedTasks = await _taskAcceptanceRepo.GetByProjectIdAsync(project.Id);

            return Json(
                new
                {
                    success = true,
                    data = new
                    {
                        projectName = project.ProjectName ?? "N/A",
                        departmentName = deptName,
                        location = project.Location.ToString() ?? "N/A",
                        startingDate = project.StartDate.ToString("dd/MM/yyyy"),
                        assignedUsers = assignedUsers,
                        assignedBy = project.AssignedBy,
                        teamSize = assignedUsers.Count,
                        description = project.Description ?? "No Description / Requirements",
                        statusName = project.Status.ToString(),
                        tasks = tasks,
                        acceptedTasks = acceptedTasks,
                    },
                }
            );
        }
    }
}
