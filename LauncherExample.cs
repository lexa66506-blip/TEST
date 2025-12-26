using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace VodkaClientLauncher
{
    /// <summary>
    /// Пример интеграции лоадера с API VodkaClient
    /// </summary>
    public class VodkaAuthClient
    {
        private const string API_URL = "https://vodka-wf8h.onrender.com";
        private readonly HttpClient _httpClient;

        public VodkaAuthClient()
        {
            _httpClient = new HttpClient();
            _httpClient.BaseAddress = new Uri(API_URL);
        }

        /// <summary>
        /// Проверка подписки по логину и паролю
        /// </summary>
        public async Task<SubscriptionResponse> CheckSubscription(string username, string password)
        {
            try
            {
                var requestData = new
                {
                    username = username,
                    password = password
                };

                var json = JsonSerializer.Serialize(requestData);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/api/launcher/check-subscription", content);
                var responseText = await response.Content.ReadAsStringAsync();

                var result = JsonSerializer.Deserialize<SubscriptionResponse>(responseText);
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка проверки подписки: {ex.Message}");
                return new SubscriptionResponse
                {
                    Success = false,
                    Message = "Ошибка соединения с сервером",
                    HasSubscription = false
                };
            }
        }

        /// <summary>
        /// Быстрая проверка подписки по UID
        /// </summary>
        public async Task<SubscriptionResponse> CheckSubscriptionByUID(int uid)
        {
            try
            {
                var response = await _httpClient.GetAsync($"/api/launcher/check-uid/{uid}");
                var responseText = await response.Content.ReadAsStringAsync();

                var result = JsonSerializer.Deserialize<SubscriptionResponse>(responseText);
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка проверки подписки: {ex.Message}");
                return new SubscriptionResponse
                {
                    Success = false,
                    Message = "Ошибка соединения с сервером",
                    HasSubscription = false
                };
            }
        }
    }

    /// <summary>
    /// Ответ от API
    /// </summary>
    public class SubscriptionResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public bool HasSubscription { get; set; }
        public UserInfo User { get; set; }
        public SubscriptionInfo Subscription { get; set; }
    }

    public class UserInfo
    {
        public int UID { get; set; }
        public string Username { get; set; }
        public string CreatedAt { get; set; }
    }

    public class SubscriptionInfo
    {
        public string Type { get; set; }
        public string Expires { get; set; }
        public bool Active { get; set; }
    }

    /// <summary>
    /// Пример использования в лоадере
    /// </summary>
    public class LauncherExample
    {
        private VodkaAuthClient _authClient;
        private int? _savedUID; // Сохраненный UID из прошлого запуска

        public LauncherExample()
        {
            _authClient = new VodkaAuthClient();
            _savedUID = LoadSavedUID(); // Загрузить из файла/реестра
        }

        public async Task<bool> TryLaunchGame()
        {
            // Если есть сохраненный UID - быстрая проверка
            if (_savedUID.HasValue)
            {
                Console.WriteLine("Проверка подписки...");
                var quickCheck = await _authClient.CheckSubscriptionByUID(_savedUID.Value);

                if (quickCheck.Success && quickCheck.HasSubscription)
                {
                    Console.WriteLine($"Добро пожаловать, {quickCheck.User.Username}!");
                    LaunchGame();
                    return true;
                }
                else
                {
                    Console.WriteLine("Подписка истекла или не найдена.");
                    _savedUID = null; // Сбросить сохраненный UID
                }
            }

            // Показать форму входа
            Console.Write("Логин: ");
            string username = Console.ReadLine();

            Console.Write("Пароль: ");
            string password = ReadPassword();

            Console.WriteLine("\nПроверка данных...");
            var loginCheck = await _authClient.CheckSubscription(username, password);

            if (!loginCheck.Success)
            {
                Console.WriteLine($"Ошибка: {loginCheck.Message}");
                return false;
            }

            if (!loginCheck.HasSubscription)
            {
                Console.WriteLine("У вас нет активной подписки!");
                Console.WriteLine("Купите подписку на сайте: https://vodka-wf8h.onrender.com");
                return false;
            }

            // Сохранить UID для следующего запуска
            _savedUID = loginCheck.User.UID;
            SaveUID(_savedUID.Value);

            Console.WriteLine($"Добро пожаловать, {loginCheck.User.Username}!");
            Console.WriteLine($"Подписка: {loginCheck.Subscription.Type}");
            
            LaunchGame();
            return true;
        }

        private void LaunchGame()
        {
            Console.WriteLine("Запуск игры...");
            // Здесь код запуска игры
        }

        private int? LoadSavedUID()
        {
            // Загрузить UID из файла или реестра
            // Пример: return int.Parse(File.ReadAllText("uid.txt"));
            return null;
        }

        private void SaveUID(int uid)
        {
            // Сохранить UID в файл или реестр
            // Пример: File.WriteAllText("uid.txt", uid.ToString());
        }

        private string ReadPassword()
        {
            string password = "";
            ConsoleKeyInfo key;
            do
            {
                key = Console.ReadKey(true);
                if (key.Key != ConsoleKey.Backspace && key.Key != ConsoleKey.Enter)
                {
                    password += key.KeyChar;
                    Console.Write("*");
                }
                else if (key.Key == ConsoleKey.Backspace && password.Length > 0)
                {
                    password = password.Substring(0, password.Length - 1);
                    Console.Write("\b \b");
                }
            } while (key.Key != ConsoleKey.Enter);
            return password;
        }
    }

    /// <summary>
    /// Точка входа
    /// </summary>
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.Title = "VodkaClient Launcher";
            Console.WriteLine("=================================");
            Console.WriteLine("   VodkaClient Launcher v1.0");
            Console.WriteLine("=================================\n");

            var launcher = new LauncherExample();
            bool success = await launcher.TryLaunchGame();

            if (!success)
            {
                Console.WriteLine("\nНажмите любую клавишу для выхода...");
                Console.ReadKey();
            }
        }
    }
}
