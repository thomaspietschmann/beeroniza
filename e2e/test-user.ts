// Credentials for the isolated e2e test account. Created by global setup with
// its own seeded templates and torn down afterwards, so tests never touch real
// (or production) data. CI should additionally point DATABASE_URL at a throwaway
// test database.
export const TEST_EMAIL = "e2e@beeroniza.test";
export const TEST_PASSWORD = "e2e-pw-abc12345";
