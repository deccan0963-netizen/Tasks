// using System;
// using System.Collections.Generic;
// using System.Linq;
// using System.Threading.Tasks;
// using Microsoft.AspNetCore.Mvc;
// using Microsoft.EntityFrameworkCore;
// using TaskManagement.Data;
// using TaskManagement.Models;
// using TaskManagement.Service;

// namespace TaskManagement.Controllers
// {
//     public class ChatController : Controller
//     {
//         private readonly TaskManagementContext _context;
//         private readonly ApiDepartmentLoad _apiDepartmentLoad;
//         private readonly ApiUserLoader _apiUserLoader;

//         public ChatController(
//             TaskManagementContext context,
//             ApiDepartmentLoad apiDepartmentLoad,
//             ApiUserLoader apiUserLoader
//         )
//         {
//             _context = context;
//             _apiDepartmentLoad = apiDepartmentLoad;
//             _apiUserLoader = apiUserLoader;
//         }

//         public async Task<IActionResult> ProjectDashboard()
//         {
//             try
//             {
//                 var usersResult = await _apiUserLoader.GetApiListDataAsync<ApiUserDto>();
//                 var projects = await _context.Projects.Where(p => p.IsDeleted == "N").ToListAsync();
//                 var tasks = await _context.Tasks.Where(t => t.IsDeleted == "N").ToListAsync();
//                 var acceptances = await _context
//                     .ProjectAcceptances.Where(pa => pa.IsDeleted == "N")
//                     .ToListAsync();

//                 var deptResult = _apiDepartmentLoad.GetApiListDataAsync<ApiDeptDto>().Result;
//                 var departments = deptResult.IsSuccess ? deptResult.Value : new List<ApiDeptDto>();

//                 var acceptanceData = acceptances
//                     .Select(a => new
//                     {
//                         id = a.Id,
//                         projectId = a.ProjectId,
//                         projectName = a.ProjectName,
//                         userId = a.UserId,
//                         userName = a.UserName,
//                         status = a.Status.ToString(),
//                         createdAt = a.CreatedTime,
//                         updatedAt = a.UpdatedTime,
//                     })
//                     .ToList();

//                 var allTasksData = tasks
//                     .Select(t => new
//                     {
//                         id = t.Id,
//                         name = GetPropertyValue(t, "Name")
//                             ?? GetPropertyValue(t, "TaskName")
//                             ?? "Unnamed Task",
//                         description = GetPropertyValue(t, "Description")
//                             ?? GetPropertyValue(t, "TaskDescription")
//                             ?? "No description",
//                         status = GetPropertyValue(t, "Status")
//                             ?? GetPropertyValue(t, "TaskStatus")
//                             ?? "Pending",
//                         dueDate = GetPropertyValue(t, "DueDate")
//                             ?? GetPropertyValue(t, "TaskDueDate")
//                             ?? DateTime.Now,
//                         assignedUsers = GetPropertyValue(t, "AssignedUsers")
//                             ?? GetPropertyValue(t, "AssignedTo")
//                             ?? "Unassigned",
//                         projectName = GetPropertyValue(t, "ProjectName") ?? "Unknown Project",
//                     })
//                     .ToList();

//                 ViewBag.Users = usersResult.IsSuccess ? usersResult.Value : new List<ApiUserDto>();
//                 ViewBag.Projects = projects;
//                 ViewBag.Tasks = tasks;
//                 ViewBag.Departments = departments;
//                 ViewBag.Acceptances = acceptanceData;
//                 ViewBag.AllTasks = allTasksData;

//                 return View();
//             }
//             catch (Exception ex)
//             {
//                 ViewBag.Users = new List<ApiUserDto>();
//                 ViewBag.Projects = new List<ProjectModel>();
//                 ViewBag.Tasks = new List<TaskModel>();
//                 ViewBag.Departments = new List<ApiDeptDto>();
//                 ViewBag.Acceptances = new List<object>();
//                 ViewBag.AllTasks = new List<object>();

//                 return View("Error", new[] { $"An error occurred: {ex.Message}" });
//             }
//         }

//         private object GetPropertyValue(object obj, string propertyName)
//         {
//             try
//             {
//                 var property = obj.GetType().GetProperty(propertyName);
//                 return property?.GetValue(obj);
//             }
//             catch
//             {
//                 return null;
//             }
//         }

//         [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
//         public IActionResult Error()
//         {
//             return View(new ErrorViewModel { });
//         }
//     }
// }
