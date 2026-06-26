using System.Text.Json.Serialization;

namespace RPGXpTracker.Pathfinder.Contracts;

// ── Ability scores ────────────────────────────────────────────────────────────

/// <summary>The six core ability scores used throughout Pathfinder 1e.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AbilityScore
{
    STR, DEX, CON, INT, WIS, CHA
}

// ── Alignment ────────────────────────────────────────────────────────────────

/// <summary>The nine standard alignment codes (Law/Chaos × Good/Evil matrix).</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AlignmentCode
{
    LG, NG, CG,
    LN, N,  CN,
    LE, NE, CE
}

/// <summary>Rule governing which alignments a class permits its members to have.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AlignmentRuleType
{
    ANY,
    ANY_NONLAWFUL,
    ANY_NEUTRAL,
    DEITY_ONE_STEP,
    CUSTOM
}

// ── Combat & progression ──────────────────────────────────────────────────────

/// <summary>
/// Hit die size used by the class to determine HP per level.
/// Deserialized from lowercase strings ("d6", "d8", "d10", "d12") via <see cref="HitDieConverter"/>.
/// </summary>
[JsonConverter(typeof(HitDieConverter))]
public enum HitDie
{
    D6  = 6,
    D8  = 8,
    D10 = 10,
    D12 = 12,
}

/// <summary>Rate at which a class's base attack bonus increases per level.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BaseAttackBonusProgression
{
    /// <summary>+1 per level (Fighter, Barbarian, Paladin, Ranger).</summary>
    FULL,
    /// <summary>+3 every 4 levels (Bard, Cleric, Druid, Monk, Rogue).</summary>
    THREE_QUARTERS,
    /// <summary>+1 every 2 levels (Sorcerer, Wizard).</summary>
    HALF
}

/// <summary>Rate at which a saving throw progresses per level.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SaveProgression
{
    /// <summary>Starts at +2, gains +1 every 2 levels.</summary>
    GOOD,
    /// <summary>Starts at +0, gains +1 every 3 levels.</summary>
    POOR
}

// ── Features ─────────────────────────────────────────────────────────────────

/// <summary>Rules-mechanical category of a class feature.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FeatureType
{
    EXTRAORDINARY,
    SUPERNATURAL,
    SPELL_LIKE,
    CLASS_FEATURE,
    NONE
}

/// <summary>Action cost required to activate or use a class feature.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ActionType
{
    NONE,
    PASSIVE,
    FREE,
    SWIFT,
    IMMEDIATE,
    MOVE,
    STANDARD,
    FULL_ROUND
}

/// <summary>How a class feature's numeric benefit scales with character level.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FeatureScalingType
{
    NONE,
    VALUE_BY_LEVEL,
    FORMULA
}

/// <summary>What category of option a player must select when a feature is gained.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ChoiceType
{
    NONE,
    FEAT,
    DOMAIN,
    WEAPON_GROUP,
    BLOODLINE,
    SCHOOL,
    COMPANION,
    CUSTOM
}

// ── Spellcasting ─────────────────────────────────────────────────────────────

/// <summary>Magical tradition from which a spellcasting class draws its spells.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SpellcastingType
{
    ARCANE,
    DIVINE,
    PSYCHIC,
    NONE
}

/// <summary>Whether a caster prepares spells in advance or knows a fixed list and casts freely.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CastingStyle
{
    PREPARED,
    SPONTANEOUS,
    /// <summary>Hybrid casters (e.g. Arcanist from Advanced Class Guide) blend both styles.</summary>
    HYBRID,
    NONE
}

// ── Proficiencies ─────────────────────────────────────────────────────────────

/// <summary>Armor weight categories a class may grant proficiency in.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ArmorProficiency
{
    LIGHT,
    MEDIUM,
    HEAVY
}

/// <summary>Shield categories a class may grant proficiency in.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShieldProficiency
{
    SHIELD,
    TOWER_SHIELD
}

/// <summary>The breadth of a weapon proficiency grant.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WeaponProficiencyCategory
{
    SIMPLE,
    MARTIAL,
    EXOTIC,
    /// <summary>An explicit list of specific weapons defined in <c>WeaponProficiencyJson.Items</c>.</summary>
    CUSTOM
}

// ── Custom converter for HitDie ───────────────────────────────────────────────

/// <summary>
/// Converts the JSON strings "d6", "d8", "d10", "d12" to and from <see cref="HitDie"/>.
/// Required because C# enum identifiers cannot begin with a digit.
/// </summary>
internal sealed class HitDieConverter : JsonConverter<HitDie>
{
    public override HitDie Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        return value switch
        {
            "d6"  => HitDie.D6,
            "d8"  => HitDie.D8,
            "d10" => HitDie.D10,
            "d12" => HitDie.D12,
            _     => throw new JsonException($"Unknown HitDie value: '{value}'. Expected one of: d6, d8, d10, d12.")
        };
    }

    public override void Write(Utf8JsonWriter writer, HitDie value, JsonSerializerOptions options)
    {
        var str = value switch
        {
            HitDie.D6  => "d6",
            HitDie.D8  => "d8",
            HitDie.D10 => "d10",
            HitDie.D12 => "d12",
            _          => throw new JsonException($"Unsupported HitDie value: {value}.")
        };
        writer.WriteStringValue(str);
    }
}
