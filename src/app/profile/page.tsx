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
      console.error("Failed to save localStorage:", err);
    }

    // navigate to the preview page with the saved data
    router.push("/preview");
  };

  return (
    <>
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block font-medium">Desired position</label>
          <input
            type="text"
            name="position"
            value={form.position}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="e.g. QA Automation Engineer"
          />
        </div>

        <div>
          <label className="block font-medium">Contact</label>
          <input
            type="text"
            name="contact"
            value={form.contact}
            onChange={handleChange}
            className="w-full border rounded p-2"
            placeholder="Phone number"
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
            placeholder="you@example.com"
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
            placeholder="e.g. JavaScript, Python, Selenium"
          />
        </div>

        <div>
          <label className="block font-medium">Experience</label>
          <textarea
            name="experience"
            value={form.experience}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium">Education</label>
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
          Save Profile
        </button>
      </form>
    </main>
    </>
  );
}
