import { describe, expect, it } from 'vitest';
import { berechneLaufweg, type Stand } from '../src/vorgaenge/laufweg.js';

const start: Stand = {
  sprengelschule: 'wartet', gastschule: 'wartet', traeger_sprengelschule: 'wartet', traeger_gastschule: 'wartet', regierung: 'bedingt',
};
const mit = (aenderung: Partial<Stand>): Stand => ({ ...start, ...aenderung });

describe('Laufweg gestuft', () => {
  it('beginnt mit beiden Schulen parallel', () => {
    expect(berechneLaufweg('gestuft', start)).toEqual({
      stand: mit({ sprengelschule: 'offen', gastschule: 'offen' }), phase: 'umlauf', bescheidDurch: null,
    });
  });

  it('öffnet die Sachaufwandsträger erst, wenn beide Schulen erklärt haben', () => {
    expect(berechneLaufweg('gestuft', mit({ sprengelschule: 'zugestimmt' })).stand.traeger_sprengelschule).toBe('wartet');
    const r = berechneLaufweg('gestuft', mit({ sprengelschule: 'zugestimmt', gastschule: 'zugestimmt' }));
    expect(r.stand.traeger_sprengelschule).toBe('offen');
    expect(r.stand.traeger_gastschule).toBe('offen');
  });

  it('Einvernehmen aller vier Stellen: Bescheid durch die Sprengelschule, Regierung entfällt', () => {
    const r = berechneLaufweg('gestuft', mit({ sprengelschule: 'zugestimmt', gastschule: 'zugestimmt', traeger_sprengelschule: 'zugestimmt', traeger_gastschule: 'zugestimmt' }));
    expect(r).toMatchObject({ phase: 'bescheid', bescheidDurch: 'sprengelschule' });
    expect(r.stand.regierung).toBe('entfaellt');
  });

  it('Dissens: Regierung wird beteiligt und erlässt danach den Bescheid', () => {
    const vier = { sprengelschule: 'zugestimmt', gastschule: 'zugestimmt', traeger_sprengelschule: 'zugestimmt', traeger_gastschule: 'abgelehnt' } as const;
    const r = berechneLaufweg('gestuft', mit(vier));
    expect(r).toMatchObject({ phase: 'regierung', bescheidDurch: null });
    expect(r.stand.regierung).toBe('offen');
    expect(berechneLaufweg('gestuft', mit({ ...vier, regierung: 'zugestimmt' }))).toMatchObject({ phase: 'bescheid', bescheidDurch: 'regierung' });
  });

  it('eine Ablehnung in Stufe 1 hält den Laufweg nicht an', () => {
    const r = berechneLaufweg('gestuft', mit({ sprengelschule: 'abgelehnt', gastschule: 'zugestimmt' }));
    expect(r.stand.traeger_sprengelschule).toBe('offen');
    expect(r.stand.regierung).toBe('bedingt');
  });
});

describe('Laufweg sequenziell', () => {
  it('lässt immer nur eine Stelle bearbeiten, in fester Reihenfolge', () => {
    expect(berechneLaufweg('sequenziell', start).stand).toEqual(mit({ sprengelschule: 'offen' }));
    expect(berechneLaufweg('sequenziell', mit({ sprengelschule: 'zugestimmt' })).stand).toEqual(mit({ sprengelschule: 'zugestimmt', gastschule: 'offen' }));
    const r = berechneLaufweg('sequenziell', mit({ sprengelschule: 'zugestimmt', gastschule: 'zugestimmt', traeger_sprengelschule: 'zugestimmt' }));
    expect(r.stand.traeger_gastschule).toBe('offen');
  });
});
