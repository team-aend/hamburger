import test from 'node:test';
import assert from 'node:assert/strict';
import { LAND_OBSTACLES, LAND_TREES, LAND_BENCHES, LAND_KEYS, LAND_PLACES, LAND_RADIUS, LAND_WALK_RADIUS, isLandWalkable, landDestination, landKeyDirection, landWalkPath, moveOnLand, nearbyLandPlace, stepToward, type LandPoint } from '../src/data/burgerLand';

test('each land building enters the existing activity with a return-to-land marker', () => {
  assert.deepEqual(LAND_PLACES.map(landDestination), ['/?from=land', '/game?from=land', '/burger-mbti?from=land', '/ranking?from=land']);
  assert.equal(new Set(LAND_PLACES.map((place) => place.id)).size, 4);
});

test('automatic walks from roads and grass detour around buildings, including redirected walks', () => {
  for (const start of [[0, 1.6], [0, -14], [-12, -2], [12, 7], [0, 14], [-11, -8], [11, 0], [-7, -10], [-9.15, -4.9]] as LandPoint[]) {
    for (const place of LAND_PLACES) {
      const path = landWalkPath(start, place.entrance);
      let previous = start;
      for (const point of path) {
        for (let sample = 0; sample <= 100; sample++) {
          assert.ok(isLandWalkable([previous[0] + (point[0] - previous[0]) * sample / 100, previous[1] + (point[1] - previous[1]) * sample / 100]));
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

test('keyboard and touch directions move across ground and stop at island and building boundaries', () => {
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
    assert.ok(isLandWalkable(point));
    assert.ok(Math.hypot(...point) <= LAND_WALK_RADIUS);
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

test('expanded ground allows long walks while remaining on the island and outside buildings', () => {
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

test('grass is freely walkable, with collision from every side of every building', () => {
  for (const point of [[2, 0], [-4, -9], [10, 9], [-9, 10], [0, -14]] as LandPoint[]) {
    assert.ok(isLandWalkable(point), `grass ${point} is walkable`);
  }
  const grassWalk = moveOnLand([0, 0], [1, 0], 2);
  assert.ok(Math.hypot(grassWalk[0] - 2, grassWalk[1]) < 1e-9);
  assert.equal(isLandWalkable([15, 0]), false);
  assert.equal(isLandWalkable([11, 11]), false);
  for (const place of LAND_PLACES) {
    assert.equal(isLandWalkable(place.position), false);
    for (const direction of [[1, 0], [-1, 0], [0, 1], [0, -1]] as LandPoint[]) {
      const start: LandPoint = [place.position[0] - direction[0] * 3, place.position[1] - direction[1] * 3];
      const end = moveOnLand(start, direction, 6);
      assert.ok(isLandWalkable(end));
      assert.ok(Math.hypot(end[0] - place.position[0], end[1] - place.position[1]) >= 2.15);
      assert.ok(Math.hypot(end[0] - start[0], end[1] - start[1]) < 1);
    }
  }
});

test('all rendered trees and benches block manual movement from accessible sides', () => {
  const objects = LAND_OBSTACLES.filter((obstacle) => obstacle.kind !== 'building');
  assert.equal(objects.filter((object) => object.kind === 'tree').length, LAND_TREES.length);
  assert.equal(objects.filter((object) => object.kind === 'bench').length, LAND_BENCHES.length);
  for (const object of objects) {
    assert.equal(isLandWalkable(object.position), false);
    let approaches = 0;
    for (const direction of [[1, 0], [-1, 0], [0, 1], [0, -1]] as LandPoint[]) {
      const axis = direction[0] ? 0 : 1;
      const distance = object.halfSize[axis] + .25;
      const start: LandPoint = [object.position[0] - direction[0] * distance, object.position[1] - direction[1] * distance];
      if (!isLandWalkable(start)) continue;
      approaches++;
      const end = moveOnLand(start, direction, distance * 2);
      assert.ok(isLandWalkable(end));
      assert.ok(Math.hypot(end[0] - start[0], end[1] - start[1]) <= .251, `${object.kind} stops movement`);
    }
    assert.ok(approaches >= 2);
  }
});

test('automatic movement routes around trees and benches and still reaches all entrances', () => {
  for (const object of LAND_OBSTACLES.filter((obstacle) => obstacle.kind !== 'building')) {
    const start: LandPoint = [object.position[0] - object.halfSize[0] - .25, object.position[1]];
    if (!isLandWalkable(start)) continue;
    for (const place of LAND_PLACES) {
      let previous = start;
      const path = landWalkPath(start, place.entrance);
      assert.ok(path.length);
      for (const point of path) {
        const samples = Math.ceil(Math.hypot(point[0] - previous[0], point[1] - previous[1]) / .02);
        for (let i = 0; i <= samples; i++) {
          assert.ok(isLandWalkable([previous[0] + (point[0] - previous[0]) * i / samples, previous[1] + (point[1] - previous[1]) * i / samples]));
        }
        previous = point;
      }
      assert.deepEqual(previous, place.entrance);
    }
  }
});
