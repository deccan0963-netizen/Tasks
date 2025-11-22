// /Interfaces/IErrorLogger.cs
using System;

namespace TaskManagement.Interfaces
{
    public interface IErrorLogger
    {
        void LogError(Exception ex, string context = "");
        void LogInfo(string message, string context = "");
    }
}
