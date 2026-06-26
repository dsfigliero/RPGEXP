namespace RPGXpTracker.Pathfinder.Contracts;

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// The result of validating a <see cref="PathfinderClassJson"/> document.
/// Consumers should check <see cref="IsValid"/> before attempting to persist the class.
/// </summary>
public sealed class ValidationResult
{
    /// <summary><see langword="true"/> when there are no errors (warnings are acceptable).</summary>
    public bool IsValid => Errors.Count == 0;

    /// <summary>
    /// Blocking problems that prevent the class from being persisted.
    /// Examples: missing required IDs, out-of-range level numbers, dangling feature references.
    /// </summary>
    public List<string> Errors { get; } = [];

    /// <summary>
    /// Non-blocking issues worth surfacing to the user.
    /// Examples: spontaneous caster missing spellsKnown, feature referenced but never granted, empty archetypes.
    /// </summary>
    public List<string> Warnings { get; } = [];

    /// <summary>Formats the result as a human-readable summary string.</summary>
    public override string ToString() =>
        IsValid
            ? $"Valid. {Warnings.Count} warning(s)."
            : $"Invalid. {Errors.Count} error(s), {Warnings.Count} warning(s).\n"
              + string.Join('\n', Errors.Select(e => $"  [ERROR] {e}"))
              + (Warnings.Count > 0 ? "\n" + string.Join('\n', Warnings.Select(w => $"  [WARN]  {w}")) : string.Empty);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Validates a <see cref="PathfinderClassJson"/> document against the Pathfinder 1e contract rules.
/// </summary>
/// <remarks>
/// Validation rules applied:
/// <list type="number">
///   <item>Top-level required fields (<c>id</c>, <c>name</c>) must be non-empty.</item>
///   <item><c>levels</c> must have 1–20 entries; all <c>level</c> values must be unique and in range 1–20.</item>
///   <item>Every feature ID in <c>levels[].features</c> must exist in <c>features[]</c>.</item>
///   <item>Feature IDs within <c>features[]</c> must be unique.</item>
///   <item>Every level referenced in <c>features[].gainedAtLevels</c> must be in range 1–20.</item>
///   <item>Archetype IDs must be unique and their replaced/granted feature references must be valid.</item>
///   <item>Spellcasting fields are cross-validated for range and style consistency.</item>
/// </list>
/// </remarks>
public static class PathfinderClassValidator
{
    /// <summary>
    /// Validates the given class definition and returns a <see cref="ValidationResult"/>
    /// containing all errors and warnings found.
    /// </summary>
    public static ValidationResult Validate(PathfinderClassJson cls)
    {
        ArgumentNullException.ThrowIfNull(cls);
        var r = new ValidationResult();

        ValidateIdentity(cls, r);
        ValidateLevels(cls, r);
        ValidateFeatures(cls, r);
        ValidateArchetypes(cls, r);
        ValidateSpellcasting(cls, r);

        return r;
    }

    // ── Identity ──────────────────────────────────────────────────────────────

    private static void ValidateIdentity(PathfinderClassJson cls, ValidationResult r)
    {
        if (string.IsNullOrWhiteSpace(cls.Id))
            r.Errors.Add("'id' is required and must not be empty.");

        if (string.IsNullOrWhiteSpace(cls.Name))
            r.Errors.Add("'name' is required and must not be empty.");

        if (cls.Id is not null && cls.Id.Any(char.IsWhiteSpace))
            r.Errors.Add($"'id' must not contain whitespace. Got: '{cls.Id}'.");
    }

    // ── Level progression ─────────────────────────────────────────────────────

    private static void ValidateLevels(PathfinderClassJson cls, ValidationResult r)
    {
        if (cls.Levels.Count == 0)
        {
            r.Errors.Add("'levels' must not be empty.");
            return;
        }

        if (cls.Levels.Count > 20)
            r.Errors.Add($"'levels' must not exceed 20 entries. Got {cls.Levels.Count}.");

        // All level numbers in range
        foreach (var entry in cls.Levels)
        {
            if (entry.Level is < 1 or > 20)
                r.Errors.Add($"Level entry has out-of-range 'level' value: {entry.Level}. Must be 1–20.");
        }

        // No duplicate level numbers
        var duplicateLevels = cls.Levels
            .GroupBy(l => l.Level)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dup in duplicateLevels)
            r.Errors.Add($"Duplicate level entry for level {dup}.");

        // BAB and save string format sanity (must start with + or -)
        foreach (var entry in cls.Levels)
        {
            foreach (var (field, value) in new[]
            {
                ("baseAttackBonus", entry.BaseAttackBonus),
                ("fortitudeSave",   entry.FortitudeSave),
                ("reflexSave",      entry.ReflexSave),
                ("willSave",        entry.WillSave),
            })
            {
                if (!string.IsNullOrEmpty(value) && value[0] is not '+' and not '-')
                    r.Warnings.Add($"Level {entry.Level} '{field}' value '{value}' should start with '+' or '-'.");
            }
        }
    }

    // ── Features ──────────────────────────────────────────────────────────────

    private static void ValidateFeatures(PathfinderClassJson cls, ValidationResult r)
    {
        // Feature IDs must be unique within the features list
        var duplicateIds = cls.Features
            .GroupBy(f => f.Id, StringComparer.Ordinal)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dup in duplicateIds)
            r.Errors.Add($"Duplicate feature id '{dup}' in 'features'.");

        var knownFeatureIds = cls.Features
            .Select(f => f.Id)
            .ToHashSet(StringComparer.Ordinal);

        // Validate each feature
        foreach (var feature in cls.Features)
        {
            if (string.IsNullOrWhiteSpace(feature.Id))
                r.Errors.Add($"A feature is missing its 'id' field (name: '{feature.Name}').");

            if (string.IsNullOrWhiteSpace(feature.Name))
                r.Warnings.Add($"Feature '{feature.Id}' is missing a 'name'.");

            // gainedAtLevels must be in range
            foreach (var lvl in feature.GainedAtLevels)
            {
                if (lvl is < 1 or > 20)
                    r.Errors.Add($"Feature '{feature.Id}' has out-of-range gainedAtLevels entry: {lvl}.");
            }

            // Scaling formula consistency
            if (feature.Scaling is { Type: FeatureScalingType.VALUE_BY_LEVEL } sc && sc.Values.Count == 0)
                r.Warnings.Add($"Feature '{feature.Id}' uses VALUE_BY_LEVEL scaling but 'values' is empty.");

            if (feature.Scaling is { Type: FeatureScalingType.FORMULA } sf && string.IsNullOrWhiteSpace(sf.Formula))
                r.Errors.Add($"Feature '{feature.Id}' uses FORMULA scaling but 'formula' is null or empty.");

            // replaces references must exist
            foreach (var replacedId in feature.Replaces)
            {
                if (!knownFeatureIds.Contains(replacedId))
                    r.Warnings.Add($"Feature '{feature.Id}' lists replaced feature '{replacedId}' which does not exist in 'features'.");
            }
        }

        // Level table feature references must point to known features
        foreach (var levelEntry in cls.Levels)
        {
            foreach (var featureRef in levelEntry.Features)
            {
                if (!knownFeatureIds.Contains(featureRef))
                    r.Errors.Add($"Level {levelEntry.Level} references unknown feature id '{featureRef}'. Add it to 'features' or fix the id.");
            }
        }

        // Warn about features that are never referenced in the level table
        var referencedInLevels = cls.Levels
            .SelectMany(l => l.Features)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var feature in cls.Features)
        {
            if (!referencedInLevels.Contains(feature.Id))
                r.Warnings.Add($"Feature '{feature.Id}' is defined but never referenced in 'levels[].features'.");
        }
    }

    // ── Archetypes ────────────────────────────────────────────────────────────

    private static void ValidateArchetypes(PathfinderClassJson cls, ValidationResult r)
    {
        var knownBaseFeatureIds = cls.Features
            .Select(f => f.Id)
            .ToHashSet(StringComparer.Ordinal);

        // Archetype IDs must be unique
        var duplicateArchetypeIds = cls.Archetypes
            .GroupBy(a => a.Id, StringComparer.Ordinal)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dup in duplicateArchetypeIds)
            r.Errors.Add($"Duplicate archetype id '{dup}'.");

        foreach (var archetype in cls.Archetypes)
        {
            if (string.IsNullOrWhiteSpace(archetype.Id))
                r.Errors.Add($"An archetype is missing its 'id' field (name: '{archetype.Name}').");

            // Replaced features should exist on the base class
            foreach (var replacedId in archetype.ReplacedFeatures)
            {
                if (!knownBaseFeatureIds.Contains(replacedId))
                    r.Errors.Add($"Archetype '{archetype.Id}' replaces feature '{replacedId}' which does not exist on the base class.");
            }

            // Granted feature IDs within the archetype must be unique
            var duplicateGrantedIds = archetype.GrantedFeatures
                .GroupBy(f => f.Id, StringComparer.Ordinal)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key);

            foreach (var dup in duplicateGrantedIds)
                r.Errors.Add($"Archetype '{archetype.Id}' has duplicate granted feature id '{dup}'.");

            // Archetype should actually replace or add something
            if (archetype.ReplacedFeatures.Count == 0 && archetype.GrantedFeatures.Count == 0)
                r.Warnings.Add($"Archetype '{archetype.Id}' replaces and grants nothing.");
        }
    }

    // ── Spellcasting ──────────────────────────────────────────────────────────

    private static void ValidateSpellcasting(PathfinderClassJson cls, ValidationResult r)
    {
        var sc = cls.Spellcasting;
        if (sc is null) return;

        if (sc.MaxSpellLevel is < 0 or > 9)
            r.Errors.Add($"'spellcasting.maxSpellLevel' must be 0–9. Got {sc.MaxSpellLevel}.");

        if (sc.Type == SpellcastingType.NONE)
            r.Warnings.Add("'spellcasting' is present but 'type' is NONE. Set to null for non-casters.");

        if (sc.CastingStyle == CastingStyle.NONE)
            r.Warnings.Add("'spellcasting' is present but 'castingStyle' is NONE.");

        // Spontaneous casters should have a spellsKnown table
        if (sc.CastingStyle == CastingStyle.SPONTANEOUS)
        {
            if (sc.SpellsKnown is null || sc.SpellsKnown.Count == 0)
                r.Warnings.Add("Spontaneous caster has no 'spellsKnown' entries. Provide a known spells table for Sorcerer, Bard, etc.");
        }

        // Prepared casters should not have a spellsKnown table
        if (sc.CastingStyle == CastingStyle.PREPARED && sc.SpellsKnown is { Count: > 0 })
            r.Warnings.Add("Prepared caster has a 'spellsKnown' table. This is unusual — verify the casting style.");

        // Spells per day rows
        ValidateSpellTableRows(sc.SpellsPerDay.Select(r => (r.ClassLevel, r.Slots)), "spellsPerDay", sc.MaxSpellLevel, r);

        // Spells known rows
        if (sc.SpellsKnown is not null)
            ValidateSpellTableRows(sc.SpellsKnown.Select(r => (r.ClassLevel, r.Known)), "spellsKnown", sc.MaxSpellLevel, r);

        // Spellbook casters should be arcane
        if (sc.UsesSpellbook && sc.Type != SpellcastingType.ARCANE)
            r.Warnings.Add($"Class uses a spellbook but spellcasting type is {sc.Type}, not ARCANE. Verify if intentional.");
    }

    private static void ValidateSpellTableRows(
        IEnumerable<(int ClassLevel, Dictionary<string, string?> Slots)> rows,
        string tableName,
        int maxSpellLevel,
        ValidationResult r)
    {
        var seenLevels = new HashSet<int>();

        foreach (var (classLevel, slots) in rows)
        {
            if (classLevel is < 1 or > 20)
                r.Errors.Add($"'{tableName}' has entry with out-of-range classLevel: {classLevel}.");

            if (!seenLevels.Add(classLevel))
                r.Errors.Add($"'{tableName}' has duplicate entry for classLevel {classLevel}.");

            // Slot keys must be string representations of 0–9
            foreach (var key in slots.Keys)
            {
                if (!int.TryParse(key, out var spellLevel) || spellLevel < 0 || spellLevel > 9)
                    r.Errors.Add($"'{tableName}' level {classLevel} has invalid spell level key '{key}'. Keys must be '0'–'9'.");
                else if (spellLevel > maxSpellLevel && slots[key] is not null)
                    r.Warnings.Add($"'{tableName}' level {classLevel} has a non-null value for spell level {spellLevel} which exceeds maxSpellLevel ({maxSpellLevel}).");
            }
        }
    }
}
