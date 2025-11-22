using System.Collections.Generic;
using System.Threading.Tasks;
using TaskManagement.Models;

namespace TaskManagement.Interfaces
{
    public interface ITaskAcceptanceInterface
    {
        Task<TaskAcceptanceBo> AcceptTaskAsync(int taskId, string userId);
        Task<List<TaskAcceptanceBo>> GetByUserIdAsync(string userId);
        Task<bool> IsTaskAcceptedAsync(int taskId, string userId);
        Task<List<int>> GetByProjectIdAsync(int projectId);
    }
}
