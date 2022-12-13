import SPELLS from 'common/SPELLS';
import { suggestion } from 'parser/core/Analyzer';
import aplCheck, { Apl, build, CheckResult, PlayerInfo } from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';
import talents from 'common/TALENTS/monk';
import { AnyEvent } from 'parser/core/Events';
import * as BoFLink from '../spells/BreathOfFire/normalizer';

const AOE_SCK = {
  spell: SPELLS.SPINNING_CRANE_KICK_BRM,
  condition: cnd.targetsHit(
    { atLeast: 2 },
    {
      targetSpell: SPELLS.SPINNING_CRANE_KICK_DAMAGE,
    },
  ),
};

const commonTop = [SPELLS.BONEDUST_BREW_CAST];
const commonBottom = [
  AOE_SCK,
  SPELLS.TIGER_PALM,
  talents.CHI_WAVE_TALENT,
  talents.CHI_BURST_TALENT,
];

const bofMissingCondition = cnd.debuffMissing(
  SPELLS.BREATH_OF_FIRE_DEBUFF,
  {
    timeRemaining: 1500,
    duration: 15000,
    pandemicCap: 1.5,
  },
  { targetLinkRelation: BoFLink.targetRelation },
);

const rotation_boc = build([
  ...commonTop,
  SPELLS.BLACKOUT_KICK_BRM,
  // we let you cast KS on 2+ targets regardless of BoC buff
  {
    spell: talents.KEG_SMASH_TALENT,
    condition: cnd.targetsHit({ atLeast: 2 }),
  },
  // again, slight cheat. the official APL does some BoC counting to result in a fixed rotation. we're a little more fluid
  talents.RISING_SUN_KICK_TALENT,
  {
    spell: talents.BREATH_OF_FIRE_TALENT,
    condition: cnd.and(cnd.buffPresent(SPELLS.BLACKOUT_COMBO_BUFF), bofMissingCondition),
  },
  {
    spell: talents.KEG_SMASH_TALENT,
    condition: cnd.buffPresent(SPELLS.BLACKOUT_COMBO_BUFF),
  },
  talents.EXPLODING_KEG_TALENT,
  {
    spell: talents.RUSHING_JADE_WIND_TALENT,
    // lack of pandemic stuff is intentional
    condition: cnd.buffMissing(talents.RUSHING_JADE_WIND_TALENT),
  },
  ...commonBottom,
]);

const rotation_noBoC_chpdfb = build([
  ...commonTop,
  {
    spell: talents.BREATH_OF_FIRE_TALENT,
    condition: cnd.hasTalent(talents.DRAGONFIRE_BREW_TALENT),
  },
  {
    spell: talents.BREATH_OF_FIRE_TALENT,
    condition: bofMissingCondition,
  },
  SPELLS.BLACKOUT_KICK_BRM,
  talents.KEG_SMASH_TALENT,
  talents.EXPLODING_KEG_TALENT,
  {
    spell: talents.RUSHING_JADE_WIND_TALENT,
    condition: cnd.buffMissing(talents.RUSHING_JADE_WIND_TALENT, {
      timeRemaining: 1500,
      duration: 6000,
      pandemicCap: 1.5,
    }),
  },
  talents.RISING_SUN_KICK_TALENT,
  ...commonBottom,
]);

const rotation_fallback = build([
  ...commonTop,
  talents.RISING_SUN_KICK_TALENT,
  talents.KEG_SMASH_TALENT,
  talents.BREATH_OF_FIRE_TALENT,
  SPELLS.BLACKOUT_KICK_BRM,
  talents.EXPLODING_KEG_TALENT,
  talents.RUSHING_JADE_WIND_TALENT,
  // slight modification to the fallback APL - TP on ST, SCK on AoE
  ...commonBottom,
]);

export const apl = (info: PlayerInfo): Apl => {
  if (info.combatant.hasTalent(talents.BLACKOUT_COMBO_TALENT)) {
    return rotation_boc;
  } else if (
    info.combatant.hasTalent(talents.DRAGONFIRE_BREW_TALENT) ||
    info.combatant.hasTalent(talents.CHARRED_PASSIONS_TALENT)
  ) {
    return rotation_noBoC_chpdfb;
  } else {
    return rotation_fallback;
  }
};

export const check = (events: AnyEvent[], info: PlayerInfo): CheckResult => {
  const check = aplCheck(apl(info));
  return check(events, info);
};

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);

  return undefined;
});
