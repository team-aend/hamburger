import test from 'node:test';
import assert from 'node:assert/strict';
import { LAND_PLACES, landDestination, landWalkPath, stepToward, type LandPoint } from '../src/data/burgerLand';

test('each land building enters the existing activity with a return-to-land marker', () => {
  assert.deepEqual(LAND_PLACES.map(landDestination), ['/?from=land', '/game?from=land', '/burger-mbti?from=land', '/ranking?from=land']);
  assert.equal(new Set(LAND_PLACES.map((place) => place.id)).size, 4);
});

test('walks follow the central path and never cut diagonally through buildings, including redirected walks', () => {
  for (const start of [[0, 1.6], [-4.4, -.8], [2.2, 4.7], [0, 2.8]] as LandPoint[]) {
    for (const place of LAND_PLACES) {
      const path = landWalkPath(start, place.entrance);
      let previous = start;
      for (const point of path) {
        assert.ok(previous[0] === point[0] || previous[1] === point[1]);
        previous = point;
      }
      assert.deepEqual(previous, place.entrance);
    }
  }
  assert.deepEqual(landWalkPath([0, -.8], [0, -.8]), []);
  assert.deepEqual(landWalkPath([-4.4, -.8], [-4.4, -.8]), []);
});

test('movement respects frame distance, clamps at entrances and handles zero-length paths', () => {
  assert.deepEqual(stepToward([0, 0], [3, 4], 2.5), [1.5, 2]);
  assert.deepEqual(stepToward([0, 0], [3, 4], 10), [3, 4]);
  assert.deepEqual(stepToward([3, 4], [3, 4], 0), [3, 4]);
  assert.deepEqual(stepToward([0, 0], [3, 4], -1), [0, 0]);
});
