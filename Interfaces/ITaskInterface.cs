using System.Collections.Generic;
using System.Threading.Tasks;
using FluentResults;
using TaskManagement.Models;

namespace TaskManagement.Interfaces
{
    public interface ITaskInterface
    {
        Task<Result<TaskBo>> AddAsync(TaskBo task);
        Task<Result<TaskBo>> UpdateAsync(TaskBo task);
        Task<Result<bool>> DeleteAsync(int id);
        Task<Result<List<TaskBo>>> GetAllAsync();
        Task<Result<TaskBo>> GetByIdAsync(int id);
        Task<List<TaskBo>> GetTasksByProjectId(int projectId);

    }
}
