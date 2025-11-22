using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Interfaces;
using TaskManagement.Models;
using TaskManagement.Filters;

namespace TaskManagement.Controllers
{
    [Route("TaskAcceptance")]
    [PermissionFilter("TaskAcceptance", "View")]
    public class TaskAcceptanceController : Controller
    {
        private readonly ITaskAcceptanceInterface _repository;

        public TaskAcceptanceController(ITaskAcceptanceInterface repository)
        {
            _repository = repository;
        }

        // --- Accept a Task ---
        [HttpPost("Accept")]
          [PermissionFilter("TaskAcceptance", "Accept")]  
        public async Task<JsonResult> Accept([FromBody] TaskAcceptanceBo request)
        {
            if (request == null || request.TaskId <= 0 || string.IsNullOrEmpty(request.UserId))
                return Json(new { success = false, message = "Invalid data" });

            // Check if already accepted
            var existing = await _repository.IsTaskAcceptedAsync(request.TaskId, request.UserId);
            if (existing)
                return Json(new { success = true, message = "Task already accepted" }); 

            request.AcceptedDate = DateTime.UtcNow;
            await _repository.AcceptTaskAsync(request.TaskId, request.UserId);

            return Json(new { success = true, message = "Task accepted successfully" });
        }

        // --- Get all tasks accepted by a specific user ---
        [HttpGet("UserAccepted/{userId}")]
          [PermissionFilter("TaskAcceptance", "ViewUserTasks")]
        public async Task<JsonResult> UserAccepted(string userId)
        {
            try
            {
                if (string.IsNullOrEmpty(userId))
                    return Json(new { success = false, message = "Invalid UserId" });

                var data = await _repository.GetByUserIdAsync(userId);

                // Return a List<TaskAcceptanceBo> to avoid type mismatch
                return Json(new { success = true, data = data ?? new List<TaskAcceptanceBo>() });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }
    }
}
