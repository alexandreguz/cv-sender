"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    position: "",
    skills: "",
    experience: "",
    education: "",
    name: "",
    contact: "",
    email: "",
    linkedin: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      localStorage.setItem("profilePreview", JSON.stringify(form));
    } catch (err) {
      console.error("Erro ao salvar localStorage:", err);
    }

    // navega para a página de preview com os dados salvos
    router.push("/preview");
  };

  return (
    <>
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Seu Perfil</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Nome</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label className="block font-medium">Posição desejada</label>
          <input
            type="text"
            name="position"
            value={form.position}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="Ex: QA Automation Engineer"
          />
        </div>

        <div>
          <label className="block font-medium">Contato</label>
          <input
            type="text"
            name="contact"
            value={form.contact}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="Telefone ou celular"
          />
        </div>

        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="seu@exemplo.com"
          />
        </div>

        <div>
          <label className="block font-medium">LinkedIn</label>
          <input
            type="text"
            name="linkedin"
            value={form.linkedin}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="https://www.linkedin.com/in/..."
          />
        </div>

        <div>
          <label className="block font-medium">Skills</label>
          <input
            type="text"
            name="skills"
            value={form.skills}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="Ex: JavaScript, Python, Selenium"
          />
        </div>

        <div>
          <label className="block font-medium">Experiência</label>
          <textarea
            name="experience"
            value={form.experience}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium">Educação</label>
          <textarea
            name="education"
            value={form.education}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Salvar Perfil
        </button>
      </form>
    </main>
    </>
  );
}
