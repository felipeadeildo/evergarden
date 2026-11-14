// The app's entry is a package specifier the test pool cannot resolve; server tests call modules directly.
export default {
  fetch: () => new Response(null, { status: 404 }),
};
