import { prisma } from "@/lib/db";

// Dev convenience: seed example respondents if none exist. Real numbers are
// managed in the Respondents screen. Safe to run repeatedly.
async function main() {
  const count = await prisma.respondent.count();
  if (count > 0) {
    console.log(`Respondents already present (${count}); skipping seed.`);
    return;
  }
  await prisma.respondent.createMany({
    data: [
      { name: "Family One", phone: "+15555550101" },
      { name: "Family Two", phone: "+15555550102" },
      { name: "Caregiver A", phone: "+15555550201" },
      { name: "Caregiver B", phone: "+15555550202" },
    ],
  });
  console.log("Seeded 4 respondents. Tiers are configured per-window when posting one.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
