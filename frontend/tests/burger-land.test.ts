import test from 'node:test';
import assert from 'node:assert/strict';
import { LAND_KEYS, LAND_PATH_LIMIT, LAND_PLACES, LAND_RADIUS, isLandPath, landDestination, landKeyDirection, landWalkPath, moveOnLand, nearbyLandPlace, stepToward, type LandPoint } from '../src/data/burgerLand';

test('each land building enters the existing activity with a return-to-land marker', () => {
  assert.deepEqual(LAND_PLACES.map(landDestination), ['/?from=land', '/game?from=land', '/burger-mbti?from=land', '/ranking?from=land']);
  assert.equal(new Set(LAND_PLACES.map((place) => place.id)).size, 4);
});

test('walks follow the central path and never cut diagonally through buildings, including redirected walks', () => {
  for (const start of [[0, 1.6], [0, -12], [-12, -2], [12, 7], [0, 12]] as LandPoint[]) {
    for (const place of LAND_PLACES) {
      const path = landWalkPath(start, place.entrance);
      let previous = start;
      for (const point of path) {
        assert.ok(previous[0] === point[0] || previous[1] === point[1]);
        for (let sample = 0; sample <= 10; sample++) {
          assert.ok(isLandPath([previous[0] + (point[0] - previous[0]) * sample / 10, previous[1] + (point[1] - previous[1]) * sample / 10]));
        }
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

test('keyboard and touch directions move on paths and stop at island and building boundaries', () => {
  assert.deepEqual(landKeyDirection('', 'ArrowUp'), LAND_KEYS.KeyW);
  assert.deepEqual(landKeyDirection('', 'D'), LAND_KEYS.KeyD);
  assert.equal(landKeyDirection('Enter', 'Enter'), undefined);
  assert.deepEqual(LAND_KEYS.KeyW, LAND_KEYS.ArrowUp);
  assert.deepEqual(LAND_KEYS.KeyD, LAND_KEYS.ArrowRight);
  assert.deepEqual(moveOnLand([0, 0], [0, 0], 1), [0, 0]);
  assert.deepEqual(moveOnLand([0, 0], [1, 0], 0), [0, 0]);
  const diagonal = moveOnLand([0, 1.6], [1, 1], .2);
  assert.ok(Math.abs(Math.hypot(diagonal[0], diagonal[1] - 1.6) - .2) < .00001);
  for (const direction of Object.values(LAND_KEYS)) {
    const point = moveOnLand([0, 1.6], direction, 30);
    assert.ok(isLandPath(point));
    assert.ok(Math.abs(point[0]) <= LAND_PATH_LIMIT && Math.abs(point[1]) <= LAND_PATH_LIMIT);
  }
  const blocked = moveOnLand(LAND_PLACES[0].entrance, [0, -1], 3);
  assert.ok(blocked[1] >= LAND_PLACES[0].entrance[1] - 1.05, 'cannot walk through the arena');
});

test('every entrance is reachable by manual movement and entry expires when walking away', () => {
  assert.equal(nearbyLandPlace([0, 1.6]), null);
  for (const place of LAND_PLACES) {
    let point: LandPoint = [0, 1.6];
    point = moveOnLand(point, [0, Math.sign(place.entrance[1] - point[1])], Math.abs(place.entrance[1] - point[1]));
    point = moveOnLand(point, [Math.sign(place.entrance[0]), 0], Math.abs(place.entrance[0]));
    assert.ok(Math.hypot(point[0] - place.entrance[0], point[1] - place.entrance[1]) < .001);
    assert.equal(nearbyLandPlace(point), place.id);
    const away = moveOnLand(point, [-Math.sign(point[0]), 0], 1.5);
    assert.equal(nearbyLandPlace(away), null);
  }
});

test('expanded roads allow long walks while remaining on the island and outside buildings', () => {
  assert.ok(LAND_RADIUS > 9.4 * 1.5);
  assert.ok(moveOnLand([0, 1.6], [0, -1], 30)[1] < -11.8);
  for (const place of LAND_PLACES) {
    const edge = moveOnLand([0, place.entrance[1]], [Math.sign(place.entrance[0]), 0], 30);
    assert.ok(Math.abs(edge[0]) > 11.8);
    assert.ok(Math.hypot(...edge) < LAND_RADIUS - .5);
    const blocked = moveOnLand(place.entrance, [0, -1], 4);
    assert.ok(blocked[1] > place.position[1] + 1.7, 'player stops before the building front');
  }
});
