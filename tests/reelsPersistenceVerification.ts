import {
  mapSupabaseRowToReel,
  isValidUuid,
  fetchPersistentReels,
  createPersistentReel,
  deletePersistentReel,
  editPersistentReel,
  migrateLocalStorageReels,
} from '../services/reelService';
import { ReelHighlight } from '../types/community';
import { saveReelHighlights, getReelHighlights } from '../utils/socialStore';

// In-memory mock storage for localStorage
const mockStorage = new Map<string, string>();
if (typeof window === 'undefined' || !window.localStorage) {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage.get(key) || null,
    setItem: (key: string, val: string) => mockStorage.set(key, val),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  };
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, desc: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${desc}`);
  } else {
    console.error(`  [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

export async function runReelsPersistenceVerification() {
  console.log('\n=== METFA SOCIAL: P0-1 PERSISTENT REELS INFRASTRUCTURE VERIFICATION ===\n');

  // Test Suite 1: UUID and Data Mapping Invariants
  console.log('--- Test Suite 1: UUID Validation and Supabase Row Mapping ---');
  assert(isValidUuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'), 'Valid UUIDv4 is recognized');
  assert(!isValidUuid('reel_17892348923'), 'Legacy timestamp ID is rejected as UUID');
  assert(!isValidUuid(''), 'Empty string is rejected as UUID');
  assert(!isValidUuid(null), 'Null is rejected as UUID');

  const rawRow = {
    id: 'b1ffcd88-8b0a-4fe7-aa5c-5aa8ad270b22',
    author_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    prompt: 'Cinematic AI Cyberpunk Scene',
    caption: 'Neon city in the rain #cyberpunk',
    video_src: 'https://cdn.metfasocial.com/uploads/neon_city.mp4',
    video_title: 'Cyberpunk Neon Dream',
    video_thumbnail: 'https://cdn.metfasocial.com/uploads/neon_city_thumb.jpg',
    post_type: 'reel',
    duration: 25,
    likes_count: 42,
    comments_count: 7,
    shares_count: 15,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    author: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      display_name: 'Elena Vance',
      username: 'elena_v',
      avatar_url: 'https://cdn.metfasocial.com/avatars/elena.jpg',
      is_verified: true,
    },
  };

  const mappedReel = mapSupabaseRowToReel(rawRow);
  assert(mappedReel.id === rawRow.id, 'Mapped reel preserves exact UUID');
  assert(mappedReel.author.id === rawRow.author_id, 'Mapped author ID matches author_id');
  assert(mappedReel.author.name === 'Elena Vance', 'Mapped author name matches display_name');
  assert(mappedReel.author.username === 'elena_v', 'Mapped author username matches');
  assert(mappedReel.author.isVerified === true, 'Mapped author verification status preserved');
  assert(mappedReel.videoSrc === rawRow.video_src, 'Mapped videoSrc matches database column');
  assert(mappedReel.thumbnailSrc === rawRow.video_thumbnail, 'Mapped thumbnailSrc matches');
  assert(mappedReel.duration === 25, 'Mapped duration matches');
  assert(mappedReel.likesCount === 42, 'Mapped likesCount matches');
  assert(mappedReel.commentsCount === 7, 'Mapped commentsCount matches');
  assert(mappedReel.sharesCount === 15, 'Mapped sharesCount matches');

  // Test Suite 2: Null Safety on Author and Media
  console.log('\n--- Test Suite 2: Null Safety and Author Fallbacks ---');
  const incompleteRow = {
    id: 'c2eedd77-7a0b-4fe6-994b-4bb7ac160c33',
    author_id: 'd3eecc66-6b0a-4fe5-883a-3bb6ab050d44',
    video_src: 'https://cdn.metfasocial.com/uploads/sample.mp4',
    created_at: new Date().toISOString(),
  };
  const safeReel = mapSupabaseRowToReel(incompleteRow);
  assert(safeReel.author.name === 'Metfa Creator', 'Fallback author name is Metfa Creator');
  assert(safeReel.author.username === 'creator', 'Fallback author username is creator');
  assert(Boolean(safeReel.author.avatar), 'Fallback avatar is populated');
  assert(safeReel.duration === 15, 'Default duration is 15s');
  assert(safeReel.likesCount === 0, 'Default likesCount is 0');

  // Test Suite 3: Local / Offline Fallback Fetching
  console.log('\n--- Test Suite 3: Reel Fetching and Local Store Fallback ---');
  const sampleReel: ReelHighlight = {
    id: 'reel_test_101',
    title: 'Test Local Highlight',
    caption: 'Testing offline reels fallback',
    author: {
      id: 'usr_local_test',
      name: 'Local Creator',
      username: 'local_creator',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    },
    videoSrc: 'https://actions.google.com/sounds/v1/science_fiction/scifi_hum.mp4',
    duration: 12,
    likesCount: 5,
    commentsCount: 1,
    sharesCount: 2,
    createdAt: 'Just now',
  };
  saveReelHighlights([sampleReel]);
  const localList = getReelHighlights();
  assert(localList.length >= 1, 'Local highlights store saved successfully');
  assert(localList.some((r) => r.id === 'reel_test_101'), 'Sample reel present in local store');

  const fetchRes = await fetchPersistentReels();
  assert(Array.isArray(fetchRes.reels), 'fetchPersistentReels returns an array');
  assert(fetchRes.reels.length >= 1, 'fetchPersistentReels returned local/persisted reels');

  // Test Suite 4: Persistent Reel Creation Parameter Validation
  console.log('\n--- Test Suite 4: Reel Creation Validation ---');
  const invalidRes1 = await createPersistentReel({
    title: 'No Author Test',
    caption: '',
    duration: 10,
    videoSource: 'https://cdn.metfasocial.com/uploads/test.mp4',
    author: { id: '', name: '', username: '', avatar: '' },
  });
  assert(!invalidRes1.success, 'Reel creation without author ID fails gracefully');
  assert(Boolean(invalidRes1.error), 'Explicit error message returned for missing author');

  const invalidRes2 = await createPersistentReel({
    title: 'No Video Test',
    caption: '',
    duration: 10,
    videoSource: '' as any,
    author: { id: 'usr_author_valid', name: 'Author', username: 'author', avatar: '' },
  });
  assert(!invalidRes2.success, 'Reel creation without video source fails gracefully');

  // Test Suite 5: Edit and Delete Operations
  console.log('\n--- Test Suite 5: Edit and Delete Persistence ---');
  const editResult = await editPersistentReel(
    'reel_test_101',
    { title: 'Updated Local Title', caption: 'Updated caption' },
    'usr_local_test'
  );
  assert(editResult === true, 'editPersistentReel returns true');
  const editedList = getReelHighlights();
  const editedItem = editedList.find((r) => r.id === 'reel_test_101');
  assert(editedItem?.title === 'Updated Local Title', 'Edited title reflected in store');

  const deleteResult = await deletePersistentReel('reel_test_101', 'usr_local_test');
  assert(deleteResult === true, 'deletePersistentReel returns true');
  const postDeleteList = getReelHighlights();
  assert(!postDeleteList.some((r) => r.id === 'reel_test_101'), 'Deleted reel removed from store');

  // Test Suite 6: Safe Idempotent LocalStorage Migration Invariants
  console.log('\n--- Test Suite 6: LocalStorage Migration Safety Invariants ---');
  // Scenario A: Ephemeral blob URL should be safely skipped
  const blobReel: ReelHighlight = {
    id: 'reel_blob_test',
    title: 'Ephemeral Blob Reel',
    caption: 'Should not migrate broken blob',
    author: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Owner',
      username: 'owner',
      avatar: '',
    },
    videoSrc: 'blob:http://localhost:3000/9871239812739812',
    duration: 15,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    createdAt: 'Just now',
  };
  saveReelHighlights([blobReel]);

  const migrationRes = await migrateLocalStorageReels('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  assert(migrationRes.totalLocal >= 1, 'Migration inspected local records');
  assert(migrationRes.migratedCount === 0, 'Broken blob URL is not migrated to database');
  assert(migrationRes.skippedCount >= 1, 'Broken blob URL is recorded as skipped');

  // Verify the local record was NOT silently destroyed
  const retainedList = getReelHighlights();
  assert(retainedList.some((r) => r.id === 'reel_blob_test'), 'Local blob reel was not silently destroyed');

  // Cleanup test reel
  saveReelHighlights([]);

  console.log(`\n======================================================`);
  console.log(`VERIFICATION SUMMARY: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log(`======================================================\n`);
  return { passed: passedAssertions, total: totalAssertions };
}

// Auto-run if executed directly via node / tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('reelsPersistenceVerification')) {
  runReelsPersistenceVerification().then((res) => {
    process.exit(res.passed === res.total ? 0 : 1);
  }).catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
