using System.Text.Json;
using System.Text.Json.Serialization;

namespace RPGXpTracker.Pathfinder.Contracts;

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Top-level contract for a complete Pathfinder 1e class definition imported via JSON.
/// Deserialize with <see cref="PathfinderContractSerializer.Options"/> to ensure all
/// enum converters and null-handling rules are applied correctly.
/// </summary>
public sealed class PathfinderClassJson
{
    /// <summary>
    /// Unique machine-readable identifier used as the primary key in the database
    /// and as the reference key for spell lists, archetypes, and feature cross-references.
    /// Examples: "fighter", "cleric", "sorcerer".
    /// </summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>Human-readable display name shown in the UI.</summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>Rule system this class belongs to. Defaults to "Pathfinder 1e".</summary>
    [JsonPropertyName("system")]
    public string System { get; init; } = "Pathfinder 1e";

    /// <summary>Publication that originally defined the class.</summary>
    [JsonPropertyName("source")]
    public ClassSourceJson? Source { get; init; }

    /// <summary>Flavor and role description shown in character creation.</summary>
    [JsonPropertyName("description")]
    public ClassDescriptionJson? Description { get; init; }

    /// <summary>Alignment restrictions for members of this class.</summary>
    [JsonPropertyName("alignment")]
    public AlignmentRuleJson? Alignment { get; init; }

    /// <summary>Hit die used to calculate HP per level.</summary>
    [JsonPropertyName("hitDie")]
    public HitDie HitDie { get; init; } = HitDie.D8;

    /// <summary>Skill ranks gained each level.</summary>
    [JsonPropertyName("skillRanksPerLevel")]
    public SkillRankProgressionJson? SkillRanksPerLevel { get; init; }

    /// <summary>Skills that are class skills for this class (half-cost training).</summary>
    [JsonPropertyName("classSkills")]
    public List<ClassSkillJson> ClassSkills { get; init; } = [];

    /// <summary>Weapon, armor, and shield proficiencies granted at 1st level.</summary>
    [JsonPropertyName("proficiencies")]
    public ProficienciesJson? Proficiencies { get; init; }

    /// <summary>Abstract progression curves (FULL/THREE_QUARTERS/HALF for BAB; GOOD/POOR for saves).</summary>
    [JsonPropertyName("progressionType")]
    public ClassProgressionTypeJson? ProgressionType { get; init; }

    /// <summary>
    /// One entry per character level (up to 20).
    /// The <c>features</c> array inside each entry must reference IDs that exist in <see cref="Features"/>.
    /// </summary>
    [JsonPropertyName("levels")]
    public List<ClassLevelProgressionJson> Levels { get; init; } = [];

    /// <summary>
    /// All class features keyed by their <c>id</c> field.
    /// This is the authoritative list; <see cref="ClassLevelProgressionJson.Features"/> references these IDs.
    /// </summary>
    [JsonPropertyName("features")]
    public List<ClassFeatureJson> Features { get; init; } = [];

    /// <summary>
    /// Full spellcasting configuration. <see langword="null"/> for non-spellcasting classes (Fighter, Rogue, etc.).
    /// </summary>
    [JsonPropertyName("spellcasting")]
    public SpellcastingJson? Spellcasting { get; init; }

    /// <summary>
    /// Archetypes associated with this class. May be empty.
    /// Each archetype replaces or modifies a subset of base class features.
    /// </summary>
    [JsonPropertyName("archetypes")]
    public List<ArchetypeJson> Archetypes { get; init; } = [];

    /// <summary>Free-form tags for search and filtering (e.g. "martial", "frontline", "core").</summary>
    [JsonPropertyName("tags")]
    public List<string> Tags { get; init; } = [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE / DESCRIPTION
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Publication reference for the class definition.</summary>
public sealed class ClassSourceJson
{
    /// <summary>Name of the sourcebook, e.g. "Core Rulebook", "Advanced Player's Guide".</summary>
    [JsonPropertyName("book")]
    public string Book { get; init; } = string.Empty;

    /// <summary>Page number within the book. <see langword="null"/> if unknown.</summary>
    [JsonPropertyName("page")]
    public int? Page { get; init; }
}

/// <summary>Narrative text that describes the class's fantasy role.</summary>
public sealed class ClassDescriptionJson
{
    /// <summary>Short immersive paragraph shown in character creation flavor text.</summary>
    [JsonPropertyName("flavor")]
    public string? Flavor { get; init; }

    /// <summary>Mechanical role summary (e.g. "Fighters excel at combat—both offense and defense.").</summary>
    [JsonPropertyName("role")]
    public string? Role { get; init; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Specifies which alignments are valid for a character choosing this class.
/// </summary>
public sealed class AlignmentRuleJson
{
    /// <summary>The rule type that governs alignment eligibility.</summary>
    [JsonPropertyName("type")]
    public AlignmentRuleType Type { get; init; } = AlignmentRuleType.ANY;

    /// <summary>
    /// Exhaustive list of allowed alignment codes.
    /// Populated when <see cref="Type"/> is anything other than <see cref="AlignmentRuleType.ANY"/>.
    /// </summary>
    [JsonPropertyName("allowed")]
    public List<AlignmentCode> Allowed { get; init; } = [];

    /// <summary>
    /// Human-readable explanation of the alignment restriction.
    /// Required when <see cref="Type"/> is <see cref="AlignmentRuleType.CUSTOM"/>.
    /// </summary>
    [JsonPropertyName("restrictionText")]
    public string? RestrictionText { get; init; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Determines how many skill ranks are gained each level for this class.
/// Total ranks per level = <see cref="Base"/> + <see cref="ModifierAbility"/> modifier (minimum 1).
/// </summary>
public sealed class SkillRankProgressionJson
{
    /// <summary>Fixed rank base before adding any ability modifier. Typically 2, 4, 6, or 8.</summary>
    [JsonPropertyName("base")]
    public int Base { get; init; } = 2;

    /// <summary>
    /// Ability score whose modifier is added to the base.
    /// Always <see cref="AbilityScore.INT"/> in core Pathfinder 1e.
    /// </summary>
    [JsonPropertyName("modifierAbility")]
    public AbilityScore ModifierAbility { get; init; } = AbilityScore.INT;
}

/// <summary>A single class skill entry. Characters get half-cost training on class skills.</summary>
public sealed class ClassSkillJson
{
    /// <summary>Display name of the skill as it appears in the rulebook.</summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>The key ability score used for this skill.</summary>
    [JsonPropertyName("ability")]
    public AbilityScore Ability { get; init; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFICIENCIES
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>All proficiencies granted automatically at 1st level in this class.</summary>
public sealed class ProficienciesJson
{
    /// <summary>
    /// One entry per weapon proficiency grant. Most classes have a SIMPLE and/or MARTIAL entry.
    /// Specific weapon grants use CUSTOM with an <c>items</c> list.
    /// </summary>
    [JsonPropertyName("weapons")]
    public List<WeaponProficiencyJson> Weapons { get; init; } = [];

    /// <summary>Armor weight categories the class is proficient with.</summary>
    [JsonPropertyName("armor")]
    public List<ArmorProficiency> Armor { get; init; } = [];

    /// <summary>Shield categories the class is proficient with.</summary>
    [JsonPropertyName("shields")]
    public List<ShieldProficiency> Shields { get; init; } = [];

    /// <summary>
    /// Free-text descriptions for unusual proficiencies not covered by the enums
    /// (e.g. "Monk weapons", "Gnome racial weapons").
    /// </summary>
    [JsonPropertyName("special")]
    public List<string> Special { get; init; } = [];
}

/// <summary>
/// A single weapon proficiency grant.
/// When <see cref="Category"/> is <see cref="WeaponProficiencyCategory.CUSTOM"/>,
/// <see cref="Items"/> lists the specific weapon names granted.
/// </summary>
public sealed class WeaponProficiencyJson
{
    [JsonPropertyName("category")]
    public WeaponProficiencyCategory Category { get; init; }

    /// <summary>
    /// Specific weapon display names for CUSTOM grants (e.g. "Longsword", "Shuriken", "Kama").
    /// Empty for SIMPLE, MARTIAL, and EXOTIC grants.
    /// </summary>
    [JsonPropertyName("items")]
    public List<string> Items { get; init; } = [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESSION TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Abstract progression curves that define how BAB and saving throws grow.
/// These are the summary row at the top of the class table; per-level values
/// are in <see cref="ClassLevelProgressionJson"/>.
/// </summary>
public sealed class ClassProgressionTypeJson
{
    [JsonPropertyName("baseAttackBonus")]
    public BaseAttackBonusProgression BaseAttackBonus { get; init; } = BaseAttackBonusProgression.HALF;

    [JsonPropertyName("fortitudeSave")]
    public SaveProgression FortitudeSave { get; init; } = SaveProgression.POOR;

    [JsonPropertyName("reflexSave")]
    public SaveProgression ReflexSave { get; init; } = SaveProgression.POOR;

    [JsonPropertyName("willSave")]
    public SaveProgression WillSave { get; init; } = SaveProgression.POOR;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL-BY-LEVEL PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// One row of the class table, describing what a character gains
/// when they reach a specific level in this class.
/// </summary>
public sealed class ClassLevelProgressionJson
{
    /// <summary>Class level this row applies to. Must be in the range 1–20.</summary>
    [JsonPropertyName("level")]
    public int Level { get; init; }

    /// <summary>
    /// Formatted base attack bonus string at this level.
    /// Single values for most classes ("+1"), iterative attacks for high-BAB classes ("+11/+6/+1").
    /// </summary>
    [JsonPropertyName("baseAttackBonus")]
    public string BaseAttackBonus { get; init; } = "+0";

    /// <summary>Fortitude save bonus at this level, formatted as "+0", "+2", etc.</summary>
    [JsonPropertyName("fortitudeSave")]
    public string FortitudeSave { get; init; } = "+0";

    /// <summary>Reflex save bonus at this level.</summary>
    [JsonPropertyName("reflexSave")]
    public string ReflexSave { get; init; } = "+0";

    /// <summary>Will save bonus at this level.</summary>
    [JsonPropertyName("willSave")]
    public string WillSave { get; init; } = "+0";

    /// <summary>
    /// IDs of features gained at this level.
    /// Every ID here must exist in <see cref="PathfinderClassJson.Features"/>.
    /// Repeat IDs are valid when a feature improves multiple times.
    /// </summary>
    [JsonPropertyName("features")]
    public List<string> Features { get; init; } = [];

    /// <summary>
    /// Per-level spellcasting override, if any. <see langword="null"/> for non-casters.
    /// Stored as a raw <see cref="JsonElement"/> to allow future schema extensions;
    /// the main spell tables live in <see cref="SpellcastingJson.SpellsPerDay"/>.
    /// </summary>
    [JsonPropertyName("spellcasting")]
    public JsonElement? Spellcasting { get; init; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// A single class feature — an ability, passive trait, or activated power the class provides.
/// Features that scale with level use <see cref="Scaling"/>; features that require a player
/// choice use <see cref="Choices"/>.
/// </summary>
public sealed class ClassFeatureJson
{
    /// <summary>
    /// Unique identifier within this class definition.
    /// Referenced by <see cref="ClassLevelProgressionJson.Features"/> and <see cref="ArchetypeJson.ReplacedFeatures"/>.
    /// </summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>Display name shown in the character sheet and UI.</summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>Rules-mechanical category (Extraordinary, Supernatural, Spell-Like, etc.).</summary>
    [JsonPropertyName("type")]
    public FeatureType Type { get; init; } = FeatureType.CLASS_FEATURE;

    /// <summary>Action cost required to activate this feature.</summary>
    [JsonPropertyName("actionType")]
    public ActionType ActionType { get; init; } = ActionType.PASSIVE;

    /// <summary>Full rules text describing what the feature does.</summary>
    [JsonPropertyName("description")]
    public string Description { get; init; } = string.Empty;

    /// <summary>
    /// Character levels at which this feature is first gained or improves.
    /// Must be a subset of the levels that reference this feature's ID.
    /// </summary>
    [JsonPropertyName("gainedAtLevels")]
    public List<int> GainedAtLevels { get; init; } = [];

    /// <summary>
    /// How the feature's numeric value changes with level.
    /// <see langword="null"/> for flat features with no level-dependent value.
    /// </summary>
    [JsonPropertyName("scaling")]
    public FeatureScalingJson? Scaling { get; init; }

    /// <summary>
    /// Player choice configuration for features that require selecting an option on gain
    /// (e.g. Fighter bonus feat, Cleric domain, Sorcerer bloodline, Wizard arcane school).
    /// <see langword="null"/> if no choice is required.
    /// </summary>
    [JsonPropertyName("choices")]
    public FeatureChoiceJson? Choices { get; init; }

    /// <summary>
    /// IDs of features in the same class that this feature replaces.
    /// Used by archetypes to indicate substitutions; empty for standard base class features.
    /// </summary>
    [JsonPropertyName("replaces")]
    public List<string> Replaces { get; init; } = [];

    /// <summary>Prerequisites that must be met before this feature can be taken.</summary>
    [JsonPropertyName("prerequisites")]
    public List<FeaturePrerequisiteJson> Prerequisites { get; init; } = [];
}

// ── Scaling ───────────────────────────────────────────────────────────────────

/// <summary>
/// Describes how a class feature's numeric value changes as the character gains levels.
/// Examples: Bravery's fear bonus, Sneak Attack dice, Rage rounds per day.
/// </summary>
public sealed class FeatureScalingJson
{
    [JsonPropertyName("type")]
    public FeatureScalingType Type { get; init; } = FeatureScalingType.NONE;

    /// <summary>
    /// Explicit level→value mapping used when <see cref="Type"/> is
    /// <see cref="FeatureScalingType.VALUE_BY_LEVEL"/>.
    /// Not every level needs an entry; only levels at which the value changes.
    /// </summary>
    [JsonPropertyName("values")]
    public List<FeatureScalingValueJson> Values { get; init; } = [];

    /// <summary>
    /// Mathematical expression for computed scaling when <see cref="Type"/> is
    /// <see cref="FeatureScalingType.FORMULA"/>.
    /// Supported variables: <c>level</c>, <c>classLevel</c>.
    /// Example: <c>"floor(level / 2)"</c>, <c>"1 + floor((classLevel - 1) / 4)"</c>.
    /// </summary>
    [JsonPropertyName("formula")]
    public string? Formula { get; init; }
}

/// <summary>One data point in a VALUE_BY_LEVEL scaling table.</summary>
public sealed class FeatureScalingValueJson
{
    /// <summary>The character level at which this value takes effect.</summary>
    [JsonPropertyName("level")]
    public int Level { get; init; }

    /// <summary>The numeric value of the feature at this level.</summary>
    [JsonPropertyName("value")]
    public int Value { get; init; }
}

// ── Choices ───────────────────────────────────────────────────────────────────

/// <summary>
/// Configuration for a feature that asks the player to select an option when gained.
/// Covers Fighter bonus feats (ChoiceType.FEAT), Cleric domains (ChoiceType.DOMAIN),
/// Sorcerer bloodlines (ChoiceType.BLOODLINE), Wizard arcane schools (ChoiceType.SCHOOL), etc.
/// </summary>
public sealed class FeatureChoiceJson
{
    /// <summary>
    /// Whether the choice is mandatory at the time the feature is gained.
    /// <see langword="false"/> for optional specializations.
    /// </summary>
    [JsonPropertyName("required")]
    public bool Required { get; init; } = true;

    /// <summary>The category of thing being chosen.</summary>
    [JsonPropertyName("choiceType")]
    public ChoiceType ChoiceType { get; init; } = ChoiceType.NONE;

    /// <summary>
    /// Tags or sub-categories the chosen option must belong to.
    /// Examples: <c>["COMBAT"]</c> for Fighter bonus feats, <c>["GOOD", "NEUTRAL"]</c> for domain restrictions.
    /// Empty means all options within <see cref="ChoiceType"/> are allowed.
    /// </summary>
    [JsonPropertyName("allowedTags")]
    public List<string> AllowedTags { get; init; } = [];

    /// <summary>Number of selections the player makes at once. Typically 1.</summary>
    [JsonPropertyName("amount")]
    public int Amount { get; init; } = 1;
}

// ── Prerequisites ─────────────────────────────────────────────────────────────

/// <summary>
/// A prerequisite that must be satisfied before a feature can be taken or used.
/// The <see cref="Type"/> discriminator controls how <see cref="Value"/> is interpreted.
/// </summary>
/// <example>
/// BAB prerequisite:         <c>{ "type": "BAB", "value": "6" }</c><br/>
/// Feat prerequisite:        <c>{ "type": "FEAT", "value": "Power Attack" }</c><br/>
/// Minimum class level:      <c>{ "type": "CLASS_LEVEL", "value": "5" }</c><br/>
/// Minimum ability score:    <c>{ "type": "ABILITY_SCORE", "value": "STR:13" }</c>
/// </example>
public sealed class FeaturePrerequisiteJson
{
    /// <summary>
    /// Discriminator identifying the kind of prerequisite.
    /// Suggested values: "BAB", "FEAT", "CLASS_LEVEL", "ABILITY_SCORE", "ALIGNMENT", "RACE", "CUSTOM".
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    /// <summary>
    /// The required value, interpreted according to <see cref="Type"/>.
    /// </summary>
    [JsonPropertyName("value")]
    public string Value { get; init; } = string.Empty;

    /// <summary>Optional human-readable description displayed in the UI.</summary>
    [JsonPropertyName("description")]
    public string? Description { get; init; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPELLCASTING
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Complete spellcasting configuration for a caster class.
/// This is <see langword="null"/> on <see cref="PathfinderClassJson.Spellcasting"/>
/// for non-spellcasting classes (Fighter, Barbarian, Rogue, etc.).
/// </summary>
public sealed class SpellcastingJson
{
    /// <summary>The magical tradition the class draws from.</summary>
    [JsonPropertyName("type")]
    public SpellcastingType Type { get; init; } = SpellcastingType.NONE;

    /// <summary>Whether the class prepares spells each day or knows a fixed list.</summary>
    [JsonPropertyName("castingStyle")]
    public CastingStyle CastingStyle { get; init; } = CastingStyle.NONE;

    /// <summary>
    /// Ability score that determines spell DCs, bonus spells per day, and (for spontaneous casters) spells known.
    /// </summary>
    [JsonPropertyName("ability")]
    public AbilityScore Ability { get; init; }

    /// <summary>
    /// Highest spell level this class can ever access (0–9).
    /// Full casters (Cleric, Druid, Wizard, Sorcerer) reach 9; partial casters (Bard, Paladin) reach 6 or 4.
    /// </summary>
    [JsonPropertyName("maxSpellLevel")]
    public int MaxSpellLevel { get; init; }

    /// <summary>
    /// ID that links to the shared spell list for this class.
    /// Examples: "wizard", "cleric", "bard".
    /// </summary>
    [JsonPropertyName("spellListId")]
    public string? SpellListId { get; init; }

    /// <summary>
    /// <see langword="true"/> if the class can cast 0-level spells (cantrips for arcane, orisons for divine)
    /// without consuming any spell slots.
    /// </summary>
    [JsonPropertyName("hasCantripsOrOrisons")]
    public bool HasCantripsOrOrisons { get; init; }

    /// <summary>
    /// <see langword="true"/> for Wizard, which requires a physical or magical spellbook to learn and prepare spells.
    /// <see langword="false"/> for Cleric, Druid, Sorcerer, Bard, etc.
    /// </summary>
    [JsonPropertyName("usesSpellbook")]
    public bool UsesSpellbook { get; init; }

    /// <summary>
    /// Cleric-style ability to spontaneously convert a prepared spell into a cure or inflict spell.
    /// <see langword="null"/> for classes that lack this ability.
    /// </summary>
    [JsonPropertyName("spontaneousCasting")]
    public SpontaneousCastingJson? SpontaneousCasting { get; init; }

    /// <summary>
    /// Spell slots available per class level, broken down by spell level.
    /// Values like "1+1" represent one normal slot plus one bonus slot (domain, school, or bloodline).
    /// <see langword="null"/> entries mean spells of that level are not yet available.
    /// Present for both prepared and spontaneous casters.
    /// </summary>
    [JsonPropertyName("spellsPerDay")]
    public List<SpellSlotsByLevelJson> SpellsPerDay { get; init; } = [];

    /// <summary>
    /// Spells known per class level for spontaneous casters (Sorcerer, Bard).
    /// <see langword="null"/> for prepared casters — their known spells come from a spellbook or deity.
    /// </summary>
    [JsonPropertyName("spellsKnown")]
    public List<SpellsKnownByLevelJson>? SpellsKnown { get; init; }
}

/// <summary>
/// Describes the Cleric (and Oracle) ability to trade a prepared spell for a situational spell of the same level.
/// The specific allowed substitute spells are determined by the character's alignment or patron deity.
/// </summary>
public sealed class SpontaneousCastingJson
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; init; }

    /// <summary>Rules text explaining which spells the prepared slot can be converted into.</summary>
    [JsonPropertyName("description")]
    public string Description { get; init; } = string.Empty;
}

// ── Spell tables ──────────────────────────────────────────────────────────────

/// <summary>
/// One row of the Spells Per Day table: how many spell slots the class has
/// at a given class level, organized by spell level (0–9).
/// </summary>
public sealed class SpellSlotsByLevelJson
{
    /// <summary>The class level this row describes (1–20).</summary>
    [JsonPropertyName("classLevel")]
    public int ClassLevel { get; init; }

    /// <summary>
    /// Keys are spell levels as strings ("0" through "9").
    /// Values are slot counts — plain numbers ("3"), domain/school bonus notation ("1+1"),
    /// or <see langword="null"/> when spells of that level are not available at this class level.
    /// </summary>
    [JsonPropertyName("slots")]
    public Dictionary<string, string?> Slots { get; init; } = [];
}

/// <summary>
/// One row of the Spells Known table for spontaneous casters:
/// how many spells of each level the class knows at a given class level.
/// </summary>
public sealed class SpellsKnownByLevelJson
{
    /// <summary>The class level this row describes (1–20).</summary>
    [JsonPropertyName("classLevel")]
    public int ClassLevel { get; init; }

    /// <summary>
    /// Keys are spell levels as strings ("0" through "9").
    /// Values are counts as strings, or <see langword="null"/> if that spell level is not yet accessible.
    /// </summary>
    [JsonPropertyName("known")]
    public Dictionary<string, string?> Known { get; init; } = [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHETYPES
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// An archetype is a thematic variant of a base class that replaces one or more base class
/// features with alternative abilities while keeping the rest of the class intact.
/// Full archetype JSON schemas are imported separately; this record identifies them by reference.
/// </summary>
public sealed class ArchetypeJson
{
    /// <summary>Unique identifier for this archetype, e.g. "archer", "lore-warden".</summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>Display name, e.g. "Archer", "Lore Warden".</summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    /// <summary>
    /// IDs of base class features that this archetype removes.
    /// A character with this archetype loses the listed features and gains <see cref="GrantedFeatures"/> instead.
    /// </summary>
    [JsonPropertyName("replacedFeatures")]
    public List<string> ReplacedFeatures { get; init; } = [];

    /// <summary>Features unique to this archetype that replace the ones listed in <see cref="ReplacedFeatures"/>.</summary>
    [JsonPropertyName("grantedFeatures")]
    public List<ClassFeatureJson> GrantedFeatures { get; init; } = [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERIALIZER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>
/// Provides a pre-configured <see cref="JsonSerializerOptions"/> instance for
/// deserializing <see cref="PathfinderClassJson"/> documents.
/// </summary>
public static class PathfinderContractSerializer
{
    /// <summary>
    /// Shared options that should be passed to <see cref="JsonSerializer.Deserialize{T}(string, JsonSerializerOptions?)"/>
    /// when reading class JSON payloads. Configured for:
    /// <list type="bullet">
    ///   <item>Case-insensitive property matching (tolerant of minor casing differences).</item>
    ///   <item>Null values omitted on serialization.</item>
    ///   <item>String-based enum conversion for all annotated enums.</item>
    /// </list>
    /// </summary>
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>
    /// Deserializes a <see cref="PathfinderClassJson"/> from a JSON string.
    /// </summary>
    /// <exception cref="JsonException">Thrown when the JSON is malformed or required fields are missing.</exception>
    public static PathfinderClassJson Deserialize(string json) =>
        JsonSerializer.Deserialize<PathfinderClassJson>(json, Options)
        ?? throw new JsonException("Deserialization returned null for PathfinderClassJson.");
}
