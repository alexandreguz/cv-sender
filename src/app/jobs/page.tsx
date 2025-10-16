
export default function JobsPage() {
  const jobs = [
    { id: 1, title: "QA Automation Engineer", company: "TechCorp" },
    { id: 2, title: "Fullstack Developer", company: "StartupX" },
    { id: 3, title: "Data Analyst", company: "Analytics Inc." },
  ];

  return (
    <>
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vagas Disponíveis</h1>
      <ul className="space-y-2">
        {jobs.map(job => (
          <li key={job.id} className="p-4 border rounded-lg shadow">
            <p className="font-semibold">{job.title}</p>
            <p className="text-gray-600">{job.company}</p>
          </li>
        ))}
      </ul>
    </main>
    </>
  );
}
