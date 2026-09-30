import React from "react";
import TeacherApp from "./TeacherApp";
import StudentApp from "./StudentApp";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isTeacherView = params.get("teacher") === "1";
  return isTeacherView ? <TeacherApp /> : <StudentApp />;
}
