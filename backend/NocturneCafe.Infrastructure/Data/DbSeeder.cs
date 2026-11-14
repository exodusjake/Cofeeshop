using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Services;

namespace NocturneCafe.Infrastructure.Data;

public static class DbSeeder
{
    // Free-to-use Pexels photographs (see docs/PHOTO-CREDITS.md), stored in frontend/public/images/photos.
    private static string P(int id) => $"/images/photos/{id}.jpg";
    private static readonly Dictionary<string, int> ProductPhotos = new()
    {
        ["Midnight Latte"] = 312418, ["Nocturne Cold Brew"] = 14802987, ["Ébène Mocha"] = 32927828, ["Aurum Caramel Latte"] = 30403484,
        ["Vanilla Cold Foam"] = 10540639, ["Espresso"] = 14704659, ["Flat White"] = 17467111, ["Matcha Crème"] = 28730007,
        ["Dark Chocolate"] = 1839882, ["Strawberry Cream Soda"] = 28901490, ["Earl Grey Noir"] = 327136, ["Jasmine Pearl"] = 5168518,
        ["Almond Croissant"] = 14411697, ["Pain au Chocolat"] = 14565935, ["Cinnamon Brioche"] = 4828314,
        ["Chocolate Fudge Cake"] = 12115182, ["Basque Burnt Cheesecake"] = 2067436, ["Tiramisu Cup"] = 30128890,
        ["Truffle Mushroom Toastie"] = 26936274, ["Smoked Chicken Panini"] = 2161638,
        ["Golden Hour Affogato"] = 12914800, ["Ube Honey Latte"] = 17576001,
    };
    private static readonly int[] GalleryPhotos = { 30403484, 9078030, 12115182, 416461, 14802987, 327136 };

    /// <summary>Swaps the original placeholder artwork for photographs, but only where an admin has not already replaced it.</summary>
    private static async Task UpgradePlaceholderArt(AppDbContext db)
    {
        foreach (var p in await db.Products.Where(p => p.ImageUrl != null && p.ImageUrl.StartsWith("/images/products/")).ToListAsync())
            if (ProductPhotos.TryGetValue(p.Name, out var id)) p.ImageUrl = P(id);
        foreach (var s in await db.HomepageSections.ToListAsync())
        {
            s.ContentJson = s.ContentJson.Replace("/images/hero.svg", P(29784882)).Replace("/images/story.svg", P(9078030));
            if (s.PublishedContentJson != null) s.PublishedContentJson = s.PublishedContentJson.Replace("/images/hero.svg", P(29784882)).Replace("/images/story.svg", P(9078030));
        }
        foreach (var g in await db.GalleryImages.Where(g => g.ImageUrl.StartsWith("/images/gallery-")).ToListAsync())
        {
            var n = int.TryParse(new string(g.ImageUrl.Where(char.IsDigit).ToArray()), out var k) ? k : 1;
            g.ImageUrl = P(GalleryPhotos[(n - 1) % GalleryPhotos.Length]);
        }
        foreach (var pr in await db.Promotions.Where(x => x.ImageUrl != null && x.ImageUrl.StartsWith("/images/products/")).ToListAsync())
            pr.ImageUrl = P(pr.Code == "NIGHTOWL" ? 12115182 : 312418);

        // New "quote" banner section (added after Signature) for databases seeded before it existed.
        if (!await db.HomepageSections.AnyAsync(s => s.Key == "quote"))
        {
            const int at = 6;
            foreach (var s in await db.HomepageSections.Where(s => s.SortOrder >= at).ToListAsync()) { s.SortOrder++; if (s.PublishedSortOrder >= at) s.PublishedSortOrder++; }
            var json = QuoteJson();
            db.HomepageSections.Add(new HomepageSection { Key = "quote", Name = "Quote Banner", SortOrder = at, IsEnabled = true, ContentJson = json, PublishedSortOrder = at, PublishedIsEnabled = true, PublishedContentJson = json });
        }
        await db.SaveChangesAsync();
    }

    private static string QuoteJson() => JsonSerializer.Serialize(new
    {
        text = "A place where coffee, ambiance, and the night come together.", author = "Nocturne Café", image = P(13737042),
    }, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    public static async Task InitializeAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var s = scope.ServiceProvider;
        var cfg = s.GetRequiredService<IConfiguration>();
        var log = s.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");
        var db = s.GetRequiredService<AppDbContext>();

        if (cfg.GetValue("Database:AutoMigrate", true))
        {
            if (!db.Database.GetMigrations().Any())
                throw new InvalidOperationException("No EF Core migrations found. Run: dotnet ef migrations add InitialCreate -p NocturneCafe.Infrastructure -s NocturneCafe.Api -o Migrations (see README).");
            await db.Database.MigrateAsync();
        }

        // Roles
        var roles = s.GetRequiredService<RoleManager<ApplicationRole>>();
        foreach (var r in new[] { Roles.Customer, Roles.Admin })
            if (!await roles.RoleExistsAsync(r)) await roles.CreateAsync(new ApplicationRole(r));

        if (cfg.GetValue("Database:SeedSampleData", true))
        {
            await SeedCatalog(db);
            await SeedCms(db);
            await SeedMisc(db);
            await UpgradePlaceholderArt(db);
        }

        // Secure bootstrap of the first administrator: credentials come from environment / secret store only.
        var email = cfg["Bootstrap:AdminEmail"]; var pwd = cfg["Bootstrap:AdminPassword"];
        if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(pwd))
        {
            var users = s.GetRequiredService<UserManager<ApplicationUser>>();
            if ((await users.GetUsersInRoleAsync(Roles.Admin)).Count == 0)
            {
                var admin = await users.FindByEmailAsync(email) ?? new ApplicationUser
                { UserName = email, Email = email, EmailConfirmed = true, FullName = cfg["Bootstrap:AdminName"] ?? "Administrator" };
                IdentityResult res = admin.Id == Guid.Empty || !await users.Users.AnyAsync(u => u.Id == admin.Id)
                    ? await users.CreateAsync(admin, pwd) : IdentityResult.Success;
                if (res.Succeeded) { await users.AddToRoleAsync(admin, Roles.Admin); log.LogWarning("Bootstrap administrator {Email} created. Remove Bootstrap:AdminPassword from configuration now.", email); }
                else log.LogError("Bootstrap administrator could not be created: {Errors}", string.Join("; ", res.Errors.Select(e => e.Description)));
            }
        }
    }

    private static async Task SeedCatalog(AppDbContext db)
    {
        if (await db.Categories.AnyAsync()) return;
        string[] cats = { "Coffee", "Non-Coffee", "Tea", "Pastries", "Desserts", "Meals", "Seasonal Specials" };
        var catMap = new Dictionary<string, Category>();
        for (int i = 0; i < cats.Length; i++)
        {
            var c = new Category { Name = cats[i], Slug = CatalogService.Slugify(cats[i]), SortOrder = i + 1, Description = Describe(cats[i]) };
            db.Categories.Add(c); catMap[cats[i]] = c;
        }

        // name, description, price, category, featured, signature, hot, cold, drink
        var items = new (string n, string d, decimal p, string c, bool f, bool s, bool hot, bool cold)[]
        {
            ("Midnight Latte", "Double-shot espresso, silky steamed milk and a whisper of dark cocoa.", 185, "Coffee", true, true, true, true),
            ("Nocturne Cold Brew", "Slow-steeped for 18 hours. Smooth, bold and served over a single clear cube.", 170, "Coffee", true, true, false, true),
            ("Ébène Mocha", "Dark chocolate ganache meets rich espresso, finished with cream.", 200, "Coffee", true, true, true, true),
            ("Aurum Caramel Latte", "House-made golden caramel folded into velvety espresso and milk.", 210, "Coffee", true, true, true, true),
            ("Vanilla Cold Foam", "Cold brew crowned with sweet vanilla cold foam.", 190, "Coffee", false, false, false, true),
            ("Espresso", "A concentrated double shot of our house blend.", 120, "Coffee", false, false, true, false),
            ("Flat White", "Ristretto shots with micro-foam milk. Small, strong, silky.", 175, "Coffee", false, false, true, false),
            ("Matcha Crème", "Ceremonial-grade matcha whisked with cream and lightly sweetened.", 195, "Non-Coffee", true, false, true, true),
            ("Dark Chocolate", "Thick, bittersweet drinking chocolate made from 70% cacao.", 175, "Non-Coffee", false, false, true, true),
            ("Strawberry Cream Soda", "Sparkling soda, strawberry compote and a cloud of cream.", 165, "Non-Coffee", false, false, false, true),
            ("Earl Grey Noir", "Bergamot-scented black tea with a hint of vanilla.", 140, "Tea", false, false, true, true),
            ("Jasmine Pearl", "Hand-rolled jasmine pearls, delicately floral and fragrant.", 145, "Tea", false, false, true, true),
            ("Almond Croissant", "Buttery croissant filled with frangipane and topped with toasted almonds.", 150, "Pastries", true, false, false, false),
            ("Pain au Chocolat", "Flaky laminated pastry with two bars of dark chocolate.", 140, "Pastries", false, false, false, false),
            ("Cinnamon Brioche", "Soft brioche swirled with brown sugar and cinnamon.", 135, "Pastries", false, false, false, false),
            ("Chocolate Fudge Cake", "Three layers of dense chocolate cake with warm fudge glaze.", 220, "Desserts", true, false, false, false),
            ("Basque Burnt Cheesecake", "Caramelised crust, creamy centre, served with espresso syrup.", 230, "Desserts", false, false, false, false),
            ("Tiramisu Cup", "Mascarpone, espresso-soaked ladyfingers and cocoa dust.", 210, "Desserts", false, false, false, false),
            ("Truffle Mushroom Toastie", "Sourdough, gruyère and sautéed mushrooms with truffle oil.", 285, "Meals", false, false, false, false),
            ("Smoked Chicken Panini", "Smoked chicken, pesto, roasted peppers and mozzarella.", 295, "Meals", false, false, false, false),
            ("Golden Hour Affogato", "Vanilla gelato drowned in a hot shot of espresso and gold-dusted.", 215, "Seasonal Specials", true, true, false, false),
            ("Ube Honey Latte", "Purple yam, local honey and espresso. A Nocturne seasonal exclusive.", 220, "Seasonal Specials", false, false, true, true),
        };
        var drinkCats = new[] { "Coffee", "Non-Coffee", "Tea", "Seasonal Specials" };
        foreach (var (n, d, p, c, f, s, hot, cold) in items)
        {
            var prod = new Product
            {
                Name = n, Description = d, Price = p, Category = catMap[c], IsFeatured = f, IsSignature = s, SupportsHot = hot, SupportsCold = cold,
                ImageUrl = $"/images/products/{catMap[c].Slug}.svg", Inventory = new Inventory()
            };
            bool isDrink = (hot || cold);
            if (isDrink)
            {
                prod.Variants.Add(new ProductVariant { Name = "Small (12oz)", PriceDelta = -20 });
                prod.Variants.Add(new ProductVariant { Name = "Medium (16oz)", PriceDelta = 0, IsDefault = true });
                prod.Variants.Add(new ProductVariant { Name = "Large (20oz)", PriceDelta = 25 });
                prod.Addons.Add(new ProductAddon { Name = "Extra espresso shot", Price = 40 });
                prod.Addons.Add(new ProductAddon { Name = "Oat milk", Price = 45 });
                prod.Addons.Add(new ProductAddon { Name = "Vanilla syrup", Price = 30 });
                prod.Addons.Add(new ProductAddon { Name = "Caramel drizzle", Price = 25 });
            }
            else if (c == "Meals") prod.Addons.Add(new ProductAddon { Name = "Side salad", Price = 60 });
            else if (c == "Pastries") prod.Addons.Add(new ProductAddon { Name = "Warm it up", Price = 0 });
            db.Products.Add(prod);
        }
        await db.SaveChangesAsync();
    }

    private static string Describe(string c) => c switch
    {
        "Coffee" => "Single-origin espresso & slow-brewed signatures.",
        "Non-Coffee" => "Matcha, chocolate and cream-crowned refreshers.",
        "Tea" => "Fragrant loose-leaf blends.",
        "Pastries" => "Baked fresh each morning.",
        "Desserts" => "Indulgent finishes to the night.",
        "Meals" => "Light plates to pair with your cup.",
        _ => "Limited-time creations from our bar."
    };

    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    private static async Task SeedCms(AppDbContext db)
    {
        if (!await db.HomepageSections.AnyAsync())
        {
            var defs = new (string key, string name, object content)[]
            {
                ("hero", "Hero", new { eyebrow = "NOCTURNE CAFÉ", title = "Where Every Sip Meets the Night.", subtitle = "Single-origin coffee, slow-crafted pastries and a golden glow that lasts until the last cup.",
                    backgroundImage = "/images/hero.svg", primaryButtonText = "Order Now", primaryButtonLink = "/menu", secondaryButtonText = "View Menu", secondaryButtonLink = "/menu" }),
                ("highlights", "Premium Coffee Highlights", new { title = "The Nocturne Standard", subtitle = "Three promises behind every cup.",
                    items = new[] { new { title = "Single-Origin Beans", text = "Sourced from small farms and roasted in small batches every week." },
                                    new { title = "Crafted by Hand", text = "Every drink is pulled, steamed and finished by a trained barista." },
                                    new { title = "Open Late", text = "Our golden-lit room stays open for the night owls and the dreamers." } } }),
                ("story", "Our Story", new { title = "Our Story", body = "Nocturne began as a midnight experiment: could a coffee shop feel like a candle-lit lounge and still pour the best espresso in the city? Years later, the answer lives in every cup — dark roasts, golden light and a quiet corner waiting for you.\n\nWe roast in small batches, bake every morning and keep the lights low so the flavours can speak.", image = "/images/story.svg" }),
                ("featured", "Featured Products", new { title = "Featured Favorites", subtitle = "Hand-picked by our baristas." }),
                ("signature", "Signature Coffee Collection", new { title = "The Signature Collection", subtitle = "Our most-loved creations, poured nightly." }),
                ("quote", "Quote Banner", JsonSerializer.Deserialize<JsonElement>(QuoteJson())),
                ("gallery", "Gallery", new { title = "Moments After Dark", subtitle = "A glimpse of life inside Nocturne." }),
                ("promotions", "Promotions", new { title = "Tonight's Offers", subtitle = "Limited-time treats for our guests.", message = "Free delivery on orders over ₱800 this weekend." }),
                ("reviews", "Customer Reviews", new { title = "Words From Our Guests", subtitle = "What the night crowd says." }),
                ("events", "Events", new { title = "Evenings at Nocturne", subtitle = "Live music, latte art nights and cuppings." }),
                ("newsletter", "Newsletter", new { title = "Join the Nocturne Circle", subtitle = "Seasonal menus and secret events, straight to your inbox.", buttonText = "Subscribe" }),
                ("contact", "Contact", new { title = "Visit Us", subtitle = "Come in from the dark." }),
                ("footer", "Footer Elements", new { text = "Where every sip meets the night." }),
            };
            int order = 1;
            foreach (var (key, name, content) in defs)
            {
                var json = JsonSerializer.Serialize(content, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                db.HomepageSections.Add(new HomepageSection
                {
                    Key = key, Name = name, SortOrder = order, IsEnabled = true, ContentJson = json,
                    PublishedSortOrder = order, PublishedIsEnabled = true, PublishedContentJson = json
                });
                order++;
            }
        }

        var settings = new Dictionary<string, string>
        {
            ["site.name"] = "NOCTURNE CAFÉ", ["site.tagline"] = "Where Every Sip Meets the Night.", ["site.logo"] = "", ["site.favicon"] = "",
            ["theme.color.background"] = "#0D0B0B", ["theme.color.surface"] = "#181310", ["theme.color.gold"] = "#D5AC70",
            ["theme.color.champagne"] = "#C8A66A", ["theme.color.cream"] = "#F2E8D8", ["theme.color.muted"] = "#B6A795",
            ["contact.address"] = "21 Midnight Lane, Poblacion, Makati City, Philippines", ["contact.phone"] = "+63 917 000 0000", ["contact.email"] = "hello@nocturnecafe.example",
            ["hours.text"] = "Mon–Thu: 8:00 AM – 12:00 AM\nFri–Sat: 8:00 AM – 2:00 AM\nSun: 10:00 AM – 11:00 PM",
            ["social.instagram"] = "https://instagram.com/", ["social.facebook"] = "https://facebook.com/", ["social.tiktok"] = "https://tiktok.com/",
            ["footer.text"] = "© Nocturne Café. Brewed with devotion after dark.", ["delivery.fee"] = "50",
        };
        foreach (var (k, v) in settings)
            if (!await db.SiteSettings.AnyAsync(x => x.Key == k)) db.SiteSettings.Add(new SiteSetting { Key = k, DraftValue = v, PublishedValue = v });
        if (!await db.SiteSettings.AnyAsync(x => x.Key == ContentService.PublishedFlag))
            db.SiteSettings.Add(new SiteSetting { Key = ContentService.PublishedFlag, DraftValue = "true", PublishedValue = "true" });

        var pages = new Dictionary<string, string>
        {
            ["about.title"] = "About Nocturne Café",
            ["about.body"] = "Nocturne Café is a love letter to the late hours. We source single-origin beans from small farms, roast them in-house and serve them in a room lit like a candle-lit lounge.\n\nOur baristas treat every cup as a small ritual, and our kitchen bakes daily so that the croissants, cakes and savoury plates are always at their peak.\n\nWhether you're studying, writing, dating or simply decompressing — there's a seat for you after dark.",
            ["events.intro"] = "From intimate cuppings to live acoustic nights — there's always something brewing.",
            ["events.items"] = JsonSerializer.Serialize(new[] {
                new { title = "Latte Art After Dark", date = "Every Friday · 8:00 PM", description = "Watch our baristas pour and learn the basics in a relaxed, hands-on session." },
                new { title = "Acoustic Nocturne", date = "Every Saturday · 9:00 PM", description = "Live acoustic sets from local artists, paired with our seasonal menu." },
                new { title = "Single-Origin Cupping", date = "First Sunday of the month · 3:00 PM", description = "A guided tasting of three seasonal single-origin coffees." } }),
            ["contact.intro"] = "We'd love to hear from you. Visit us, call us or send us a message.",
        };
        foreach (var (k, v) in pages)
            if (!await db.WebsiteContent.AnyAsync(x => x.Key == k)) db.WebsiteContent.Add(new WebsiteContent { Key = k, DraftValue = v, PublishedValue = v });
        await db.SaveChangesAsync();
    }

    private static async Task SeedMisc(AppDbContext db)
    {
        if (!await db.GalleryImages.AnyAsync())
        {
            string[] caps = { "Pouring the night's first latte", "Golden-hour bar", "Fresh almond croissants", "Cold brew, slow steeped", "Our corner booths", "Dessert case" };
            for (int i = 0; i < caps.Length; i++) db.GalleryImages.Add(new GalleryImage { ImageUrl = $"/images/gallery-{i + 1}.svg", Caption = caps[i], SortOrder = i + 1 });
        }
        if (!await db.Promotions.AnyAsync())
        {
            db.Promotions.AddRange(
                new Promotion { Title = "Welcome to Nocturne", Description = "10% off your first order with code WELCOME10.", Code = "WELCOME10", DiscountType = DiscountType.Percent, DiscountValue = 10, MinSubtotal = 200, ImageUrl = "/images/products/coffee.svg" },
                new Promotion { Title = "Night Owl Treat", Description = "₱50 off any order over ₱500 with code NIGHTOWL.", Code = "NIGHTOWL", DiscountType = DiscountType.Fixed, DiscountValue = 50, MinSubtotal = 500, ImageUrl = "/images/products/desserts.svg" });
        }
        if (!await db.Reviews.AnyAsync())
        {
            db.Reviews.AddRange(
                new Review { AuthorName = "Sample Guest", Rating = 5, Comment = "The Midnight Latte is dangerously good. The whole place feels like a secret.", IsApproved = true },
                new Review { AuthorName = "Sample Guest", Rating = 5, Comment = "Chocolate Fudge Cake and a cold brew at 11 PM — perfect ending to a long day.", IsApproved = true },
                new Review { AuthorName = "Sample Guest", Rating = 4, Comment = "Gorgeous interior and the almond croissant is the best I've had in the city.", IsApproved = true });
        }
        await db.SaveChangesAsync();
    }
}
