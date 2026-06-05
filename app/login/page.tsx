export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">CareCover</h1>
        <p className="text-sm text-black/60">Sign in to manage coverage windows.</p>
      </div>
      <form method="post" action="/api/login" className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="password">
          Admin password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          className="rounded-md border border-black/15 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">Incorrect password.</p>}
        <button className="rounded-md bg-black px-3 py-2 font-medium text-white">Sign in</button>
      </form>
    </main>
  );
}
