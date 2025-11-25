using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentResults;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Data;
using TaskManagement.Interfaces;
using TaskManagement.Models;
using TaskManagement.Models.Enums;

namespace TaskManagement.Repositories
{
    public class TaskRepository : ITaskInterface
    {
        private readonly TaskManagementContext _context;

        public TaskRepository(TaskManagementContext context)
        {
            _context = context;
        }

        public async Task<Result<TaskBo>> AddAsync(TaskBo task)
        {
            try
            {
                task.DueDate = DateTime.SpecifyKind(task.DueDate, DateTimeKind.Utc);
                if (task.Status == StatusEnum.Completed)
                    task.CompletedDate = DateTime.UtcNow;

                task.CreatedTime = DateTime.UtcNow;
                // task.UpdatedTime = DateTime.UtcNow;
                // task.IsDeleted = "N";
                // task.IsDisabled = "N";

                await _context.Tasks.AddAsync(task);
                await _context.SaveChangesAsync();
                return Result.Ok(task);
            }
            catch (Exception ex)
            {
                return Result.Fail<TaskBo>($"Error adding task: {ex.Message}");
            }
        }

        public async Task<Result<TaskBo>> UpdateAsync(TaskBo task)
        {
            try
            {
                var existing = await _context.Tasks.FindAsync(task.Id);
                if (existing == null)
                    return Result.Fail<TaskBo>("Task not found");

                existing.IsDisabled = "Y";
                existing.UpdatedTime = DateTime.UtcNow;

                _context.Tasks.Update(existing);

                var newTask = new TaskBo
                {
                    TaskName = task.TaskName,
                    // Department = task.Department,
                    ProjectId = task.ProjectId,
                    SelectedUserNames = task.SelectedUserNames,
                    AssignedUsers = string.Join(",", task.SelectedUserNames ?? new List<string>()),
                    AssignedBy = task.AssignedBy,
                    Description = task.Description,
                    Status = task.Status,
                    DueDate = DateTime.SpecifyKind(task.DueDate, DateTimeKind.Utc),
                    CompletedDate = task.CompletedDate,
                    CreatedTime = DateTime.UtcNow,
                    UpdatedTime = DateTime.UtcNow,
                    IsDeleted = "N",
                    IsDisabled = "N",
                };

                await _context.Tasks.AddAsync(newTask);
                await _context.SaveChangesAsync();

                return Result.Ok(newTask);
            }
            catch (Exception ex)
            {
                string inner = ex.InnerException?.Message ?? ex.Message;
                return Result.Fail<TaskBo>($"Error updating task: {inner}");
            }
        }

        public async Task<Result<bool>> DeleteAsync(int id)
        {
            try
            {
                var task = await _context.Tasks.FindAsync(id);
                if (task == null)
                    return Result.Fail<bool>("Task not found");

                task.IsDeleted = "Y";
                task.UpdatedTime = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Result.Ok(true);
            }
            catch (Exception ex)
            {
                return Result.Fail<bool>($"Error deleting task: {ex.Message}");
            }
        }

        public async Task<Result<List<TaskBo>>> GetAllAsync()
        {
            try
            {
                var tasks = await _context
                    .Tasks.Where(t => t.IsDeleted != "Y" && t.IsDisabled != "Y")
                    .Include(t => t.Project) // Include project data
                    .OrderByDescending(t => t.CreatedTime)
                    .Take(10)
                    .ToListAsync();

                return Result.Ok(tasks);
            }
            catch (Exception ex)
            {
                return Result.Fail<List<TaskBo>>($"Error fetching tasks: {ex.Message}");
            }
        }

        public async Task<Result<TaskBo>> GetByIdAsync(int id)
        {
            try
            {
                var task = await _context
                    .Tasks.Include(t => t.Project) // Include project data
                    .FirstOrDefaultAsync(t => t.Id == id && t.IsDeleted == "N");

                if (task == null)
                    return Result.Fail<TaskBo>("Task not found");

                return Result.Ok(task);
            }
            catch (Exception ex)
            {
                return Result.Fail<TaskBo>($"Error fetching task: {ex.Message}");
            }
        }

        public async Task<List<TaskBo>> GetTasksByProjectId(int projectId)
        {
            return await _context
                .Tasks.Where(t => (int)t.ProjectId == projectId && t.IsDeleted == "N")
                .GroupBy(t => t.TaskName)
                .Select(g => g.OrderByDescending(t => t.CreatedTime).First())
                .ToListAsync();
        }
    }
}
