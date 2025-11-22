using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Data;
using TaskManagement.Interfaces;
using TaskManagement.Models;

namespace TaskManagement.Repositories
{
    public class TaskAcceptanceRepository : ITaskAcceptanceInterface
    {
        private readonly TaskManagementContext _context;

        public TaskAcceptanceRepository(TaskManagementContext context)
        {
            _context = context;
        }

        public async Task<bool> IsTaskAcceptedAsync(int taskId, string userId)
        {
            return await _context.TaskAcceptances.AnyAsync(t =>
                t.TaskId == taskId && t.UserId == userId
            );
        }

        public async Task<TaskAcceptanceBo> AcceptTaskAsync(int taskId, string userId)
        {
            var acceptance = new TaskAcceptanceBo
            {
                TaskId = taskId,
                UserId = userId,
                AcceptedDate = DateTime.UtcNow,
            };
            _context.TaskAcceptances.Add(acceptance);
            await _context.SaveChangesAsync();
            return acceptance;
        }

        public async Task<List<TaskAcceptanceBo>> GetByUserIdAsync(string userId)
        {
            return await _context.TaskAcceptances
                .Where(t => t.UserId == userId)
                .ToListAsync();
        }

        // --- NEW: Get all accepted TaskIds for a given project ---
        public async Task<List<int>> GetByProjectIdAsync(int projectId)
        {
            // Join TaskAcceptances with Tasks to filter by projectId
            var acceptedTaskIds = await (
                from ta in _context.TaskAcceptances
                join t in _context.Tasks on ta.TaskId equals t.Id
                where t.ProjectId == projectId
                select ta.TaskId
            ).ToListAsync();

            return acceptedTaskIds;
        }
    }
}
