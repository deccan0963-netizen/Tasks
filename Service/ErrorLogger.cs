// /Services/ErrorLogger.cs
using System;
using System.IO;
using TaskManagement.Interfaces;

namespace TaskManagement.Service
{
    public class ErrorLogger : IErrorLogger
    {
        private readonly string _logFolder = "Logs";
        private readonly string _logFile = "errorlog.txt";

        public ErrorLogger()
        {
            if (!Directory.Exists(_logFolder))
                Directory.CreateDirectory(_logFolder);
        }

        private string GetFilePath() => Path.Combine(_logFolder, _logFile);

        public void LogError(Exception ex, string context = "")
        {
            try
            {
                var file = GetFilePath();
                using (var sw = new StreamWriter(file, true))
                {
                    sw.WriteLine("==== ERROR ====");
                    sw.WriteLine($"Date: {DateTime.Now:dd/MM/yyyy HH:mm:ss}");
                    if (!string.IsNullOrWhiteSpace(context))
                        sw.WriteLine($"Context: {context}");
                    sw.WriteLine($"Message: {ex.Message}");
                    sw.WriteLine($"Source: {ex.Source}");
                    sw.WriteLine($"StackTrace: {ex.StackTrace}");
                    sw.WriteLine("================");
                    sw.WriteLine();
                }
            }
            catch
            {
                // Never throw from logger
            }
        }

        public void LogInfo(string message, string context = "")
        {
            try
            {
                var file = GetFilePath();
                using (var sw = new StreamWriter(file, true))
                {
                    sw.WriteLine("---- INFO ----");
                    sw.WriteLine($"Date: {DateTime.Now:dd/MM/yyyy HH:mm:ss}");
                    if (!string.IsNullOrWhiteSpace(context))
                        sw.WriteLine($"Context: {context}");
                    sw.WriteLine($"Message: {message}");
                    sw.WriteLine("----------------");
                    sw.WriteLine();
                }
            }
            catch
            {
            }
        }
    }
}
