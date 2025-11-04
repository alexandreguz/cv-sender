
import LinkedinSearchForm from "../../components/LinkedinSearchForm";

export default function JobsPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Vagas Disponíveis</h1>

      <LinkedinSearchForm />

      <section>
        <h2 className="text-lg font-medium">Vagas estáticas (exemplo)</h2>
        <ul className="mt-3 space-y-2">
          <li className="p-4 border rounded-lg shadow">
            <p className="font-semibold">QA Automation Engineer</p>
            <p className="text-gray-600">TechCorp</p>
          </li>
          <li className="p-4 border rounded-lg shadow">
            <p className="font-semibold">Fullstack Developer</p>
            <p className="text-gray-600">StartupX</p>
          </li>
          <li className="p-4 border rounded-lg shadow">
            <p className="font-semibold">Data Analyst</p>
            <p className="text-gray-600">Analytics Inc.</p>
          </li>
        </ul>
      </section>
    </main>
  );
}
