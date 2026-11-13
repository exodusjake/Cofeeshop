using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Infrastructure.Services;

public class ContentService : IContentService
{
    private readonly AppDbContext _db;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string[] AllowedSettingPrefixes = { "site.", "theme.", "contact.", "social.", "hours.", "footer.", "delivery." };
    private static readonly Regex Hex = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
    public const string PublishedFlag = "site.published";

    public ContentService(AppDbContext db) => _db = db;

    // ---------- reads ----------
    public async Task<HomepageDto> GetPublicHomepageAsync()
    {
        var flag = await _db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == PublishedFlag);
        var isPublished = flag?.PublishedValue != "false";
        var sections = new List<SectionDto>();
        if (isPublished)
        {
            var rows = await _db.HomepageSections.AsNoTracking().Where(s => s.PublishedContentJson != null && s.PublishedIsEnabled)
                .OrderBy(s => s.PublishedSortOrder).ToListAsync();
            sections = rows.Select(s => new SectionDto(s.Key, s.Name, s.PublishedSortOrder ?? 0, true, Parse(s.PublishedContentJson))).ToList();
        }
        var last = await _db.ContentRevisions.AsNoTracking().Where(r => r.Action == ContentAction.Publish).OrderByDescending(r => r.CreatedAt).Select(r => (DateTimeOffset?)r.CreatedAt).FirstOrDefaultAsync();
        return new HomepageDto(sections, await GetPublicSettingsAsync(), isPublished, last, false);
    }

    public async Task<HomepageDto> GetDraftHomepageAsync()
    {
        var rows = await _db.HomepageSections.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync();
        var flag = await _db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == PublishedFlag);
        var last = await _db.ContentRevisions.AsNoTracking().Where(r => r.Action == ContentAction.Publish).OrderByDescending(r => r.CreatedAt).Select(r => (DateTimeOffset?)r.CreatedAt).FirstOrDefaultAsync();
        var settings = await GetDraftSettingsAsync();
        var dirty = rows.Any(s => s.SortOrder != s.PublishedSortOrder || s.IsEnabled != s.PublishedIsEnabled || s.ContentJson != s.PublishedContentJson)
            || await _db.SiteSettings.AnyAsync(s => s.Key != PublishedFlag && s.DraftValue != s.PublishedValue)
            || await _db.WebsiteContent.AnyAsync(s => s.DraftValue != s.PublishedValue);
        return new HomepageDto(rows.Select(s => new SectionDto(s.Key, s.Name, s.SortOrder, s.IsEnabled, Parse(s.ContentJson))).ToList(),
            settings, flag?.PublishedValue != "false", last, dirty);
    }

    public async Task<Dictionary<string, string>> GetPublicSettingsAsync() =>
        await _db.SiteSettings.AsNoTracking().Where(s => s.PublishedValue != null && s.Key != PublishedFlag).ToDictionaryAsync(s => s.Key, s => s.PublishedValue!);

    public async Task<Dictionary<string, string>> GetDraftSettingsAsync() =>
        await _db.SiteSettings.AsNoTracking().Where(s => s.Key != PublishedFlag).ToDictionaryAsync(s => s.Key, s => s.DraftValue);

    public async Task<Dictionary<string, string>> GetPagesAsync(bool draft) =>
        await _db.WebsiteContent.AsNoTracking().Where(c => draft || c.PublishedValue != null)
            .ToDictionaryAsync(c => c.Key, c => draft ? c.DraftValue : c.PublishedValue!);

    // ---------- draft saves ----------
    public async Task SaveSectionsAsync(List<SectionDto> sections, string by)
    {
        var rows = await _db.HomepageSections.ToListAsync();
        foreach (var s in sections)
        {
            var row = rows.FirstOrDefault(r => r.Key == s.Key) ?? throw new ServiceException($"Unknown section \"{s.Key}\".");
            var raw = s.Content.ValueKind == JsonValueKind.Undefined ? "{}" : s.Content.GetRawText();
            if (raw.Length > 30_000) throw new ServiceException("Section content is too large.");
            if (raw.Contains("javascript:", StringComparison.OrdinalIgnoreCase)) throw new ServiceException("Unsafe link detected in content.");
            row.SortOrder = s.SortOrder; row.IsEnabled = s.IsEnabled; row.ContentJson = raw; row.UpdatedAt = DateTimeOffset.UtcNow;
        }
        await Revision(ContentAction.SaveDraft, "Homepage draft saved", by, saveFirst: true);
    }

    public async Task SaveSettingsAsync(Dictionary<string, string> settings, string by)
    {
        var existing = await _db.SiteSettings.ToListAsync();
        foreach (var (key, value) in settings)
        {
            if (key == PublishedFlag || !AllowedSettingPrefixes.Any(key.StartsWith)) throw new ServiceException($"Setting \"{key}\" is not editable.");
            if (key.Length > 100 || value.Length > 2000) throw new ServiceException($"Setting \"{key}\" is too long.");
            if (value.Contains("javascript:", StringComparison.OrdinalIgnoreCase)) throw new ServiceException("Unsafe link detected in settings.");
            if (key.StartsWith("theme.color.") && !Hex.IsMatch(value)) throw new ServiceException($"\"{key}\" must be a hex color like #D5AC70.");
            var row = existing.FirstOrDefault(s => s.Key == key);
            if (row == null) _db.SiteSettings.Add(new SiteSetting { Key = key, DraftValue = value });
            else { row.DraftValue = value; row.UpdatedAt = DateTimeOffset.UtcNow; }
        }
        await Revision(ContentAction.SaveDraft, "Settings draft saved", by, saveFirst: true);
    }

    public async Task SavePagesAsync(Dictionary<string, string> pages, string by)
    {
        var existing = await _db.WebsiteContent.ToListAsync();
        foreach (var (key, value) in pages)
        {
            if (key.Length > 100 || value.Length > 30_000) throw new ServiceException($"Page content \"{key}\" is too large.");
            if (value.Contains("javascript:", StringComparison.OrdinalIgnoreCase)) throw new ServiceException("Unsafe link detected in content.");
            var row = existing.FirstOrDefault(s => s.Key == key);
            if (row == null) _db.WebsiteContent.Add(new WebsiteContent { Key = key, DraftValue = value });
            else { row.DraftValue = value; row.UpdatedAt = DateTimeOffset.UtcNow; }
        }
        await Revision(ContentAction.SaveDraft, "Page content draft saved", by, saveFirst: true);
    }

    // ---------- publishing ----------
    public async Task PublishAsync(string? note, string by)
    {
        // All published-state changes are saved together by a single SaveChanges (atomic); the revision row follows.
        foreach (var s in await _db.HomepageSections.ToListAsync())
        { s.PublishedSortOrder = s.SortOrder; s.PublishedIsEnabled = s.IsEnabled; s.PublishedContentJson = s.ContentJson; }
        foreach (var s in await _db.SiteSettings.ToListAsync()) s.PublishedValue = s.Key == PublishedFlag ? "true" : s.DraftValue;
        if (!await _db.SiteSettings.AnyAsync(s => s.Key == PublishedFlag)) _db.SiteSettings.Add(new SiteSetting { Key = PublishedFlag, DraftValue = "true", PublishedValue = "true" });
        foreach (var c in await _db.WebsiteContent.ToListAsync()) c.PublishedValue = c.DraftValue;
        await Revision(ContentAction.Publish, note ?? "Published", by, saveFirst: true);
    }

    public async Task UnpublishAsync(string? note, string by)
    {
        var flag = await _db.SiteSettings.FirstOrDefaultAsync(s => s.Key == PublishedFlag);
        if (flag == null) _db.SiteSettings.Add(new SiteSetting { Key = PublishedFlag, DraftValue = "false", PublishedValue = "false" });
        else { flag.PublishedValue = "false"; flag.DraftValue = "false"; }
        await Revision(ContentAction.Unpublish, note ?? "Unpublished homepage", by, saveFirst: true);
    }

    public async Task<List<RevisionDto>> GetHistoryAsync() =>
        await _db.ContentRevisions.AsNoTracking().OrderByDescending(r => r.CreatedAt).Take(100)
            .Select(r => new RevisionDto(r.Id, r.Action.ToString(), r.Note, r.ChangedBy, r.CreatedAt)).ToListAsync();

    public async Task RestoreRevisionAsync(int revisionId, string by)
    {
        var rev = await _db.ContentRevisions.AsNoTracking().FirstOrDefaultAsync(r => r.Id == revisionId) ?? throw new ServiceException("Revision not found.", 404);
        var snap = JsonSerializer.Deserialize<Snapshot>(rev.SnapshotJson, Json) ?? throw new ServiceException("Revision is corrupted.");
        var rows = await _db.HomepageSections.ToListAsync();
        foreach (var s in snap.Sections)
        {
            var row = rows.FirstOrDefault(r => r.Key == s.Key); if (row == null) continue;
            row.SortOrder = s.SortOrder; row.IsEnabled = s.IsEnabled; row.ContentJson = s.Content.GetRawText();
        }
        foreach (var (k, v) in snap.Settings)
        {
            var row = await _db.SiteSettings.FirstOrDefaultAsync(x => x.Key == k);
            if (row == null) _db.SiteSettings.Add(new SiteSetting { Key = k, DraftValue = v }); else row.DraftValue = v;
        }
        foreach (var (k, v) in snap.Pages)
        {
            var row = await _db.WebsiteContent.FirstOrDefaultAsync(x => x.Key == k);
            if (row == null) _db.WebsiteContent.Add(new WebsiteContent { Key = k, DraftValue = v }); else row.DraftValue = v;
        }
        await Revision(ContentAction.Restore, $"Restored revision #{revisionId} into draft", by, saveFirst: true);
    }

    // ---------- helpers ----------
    private record Snapshot(List<SectionDto> Sections, Dictionary<string, string> Settings, Dictionary<string, string> Pages);

    private async Task Revision(ContentAction action, string note, string by, bool saveFirst)
    {
        if (saveFirst) await _db.SaveChangesAsync();
        // Keep the change history compact: only the latest draft save is kept between publishes.
        if (action == ContentAction.SaveDraft)
        {
            var lastEntry = await _db.ContentRevisions.OrderByDescending(r => r.Id).FirstOrDefaultAsync();
            if (lastEntry is { Action: ContentAction.SaveDraft } && lastEntry.ChangedBy == by && lastEntry.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-10))
                _db.ContentRevisions.Remove(lastEntry);
        }
        var snap = new Snapshot(
            (await _db.HomepageSections.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync()).Select(s => new SectionDto(s.Key, s.Name, s.SortOrder, s.IsEnabled, Parse(s.ContentJson))).ToList(),
            await _db.SiteSettings.AsNoTracking().Where(s => s.Key != PublishedFlag).ToDictionaryAsync(s => s.Key, s => s.DraftValue),
            await _db.WebsiteContent.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.DraftValue));
        _db.ContentRevisions.Add(new ContentRevision { Action = action, Note = note, ChangedBy = by, SnapshotJson = JsonSerializer.Serialize(snap, Json) });
        await _db.SaveChangesAsync();
    }

    private static JsonElement Parse(string? json)
    {
        try { using var d = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json); return d.RootElement.Clone(); }
        catch (JsonException) { using var d = JsonDocument.Parse("{}"); return d.RootElement.Clone(); }
    }
}
