import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import BoatPrep from "@/pages/BoatPrep";

function App() {
  return (
    <div className="App">
      <BoatPrep />
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
