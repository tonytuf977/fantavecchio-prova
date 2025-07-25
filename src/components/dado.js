import { useRef, useState, useEffect } from "react";
import { useUtenti } from "../hook/useUtenti"; // Adjusted import for named export
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase"; // Ensure the path is correct

const styles = {
  body: {
    margin: 0,
    fontFamily: "Arial, sans-serif",
    background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  container: {
    perspective: "1000px",
    width: "200px",
    height: "200px",
  },
  dice: {
    width: "100%",
    height: "100%",
    position: "relative",
    transformStyle: "preserve-3d",
    cursor: "pointer",
    transition: "transform 0.3s ease",
    animationFillMode: "forwards",
  },
  diceFace: {
    position: "absolute",
    width: "200px",
    height: "200px",
    background: "white",
    border: "2px solid #ccc",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "50px",
    fontWeight: "bold",
    color: "black",
  },
  front: { transform: "translateZ(100px)" },
  back: { transform: "rotateY(180deg) translateZ(100px)" },
  right: { transform: "rotateY(90deg) translateZ(100px)" },
  left: { transform: "rotateY(-90deg) translateZ(100px)" },
  top: { transform: "rotateX(90deg) translateZ(100px)" },
  bottom: { transform: "rotateX(-90deg) translateZ(100px)" },
  result: {
    marginTop: "40px", // Increased margin to create more space
    marginLeft: "20px", // Added left margin to shift text to the right
    fontSize: "2rem",
    color: "white",
    opacity: 0,
    transform: "translateY(20px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
    textAlign: "center",
  },
  resultShow: {
    opacity: 1,
    transform: "translateY(0)",
  },
};

const names = [
  "Giulio Rosario Crisci",
  "Francesco Alfieri",
  "Pasquale D'avino",
  "Gaetano Filzi",
  "Pasquale Filzi",
  "Dario Visone",
  "Sergio Cassese",
  "Daniele Casciello",
  "Raffaele Esposito",
  "Carmine Napolitano",
  "Davide Felicella",
  "Giuseppe Novetti",
];

export default function Dado() {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [user, setUser] = useState(null);
  const [isDado, setIsDado] = useState(false);
  const { utenti, loading } = useUtenti(); // Correct usage of the named export
  const diceRef = useRef();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      console.log("Dado: User auth state changed, currentUser =", currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !loading) {
      const userRecord = utenti.find((u) => u.email === user.email);
      const isDadoStatus = userRecord?.isDado === true;
      setIsDado(isDadoStatus);
      console.log("Dado: isDado set to", isDadoStatus);
    } else {
      setIsDado(false);
      console.log("Dado: isDado set to false (no user or loading)");
    }
  }, [user, utenti, loading]);

  const canRoll = isDado;

  const handleClick = () => {
    if (!canRoll || rolling) return;
    setRolling(true);
    setShowResult(false);

    if (diceRef.current) {
      diceRef.current.style.animation = "roll 2s ease-out";
    }

    setTimeout(() => {
      if (diceRef.current) {
        diceRef.current.style.animation = "";
      }
      setRolling(false);
      const randomName = names[Math.floor(Math.random() * names.length)];
      setResult(randomName);
      setShowResult(true);
    }, 2000);
  };

  // Dice face dot layouts
  const dotPositions = [
    // 1
    [[1, 1]],
    // 2
    [
      [0, 0],
      [2, 2],
    ],
    // 3
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    // 4
    [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ],
    // 5
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    // 6
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  ];

  // Render dots for a face
  function renderDots(face) {
    const positions = dotPositions[face - 1];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateRows: "repeat(3, 1fr)",
          gridTemplateColumns: "repeat(3, 1fr)",
          width: "100%",
          height: "100%",
        }}
      >
        {[...Array(3)].map((_, row) =>
          [...Array(3)].map((_, col) => {
            const isDot = positions.some(([r, c]) => r === row && c === col);
            return (
              <div
                key={`${row}-${col}`}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                  height: "100%",
                }}
              >
                {isDot && (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#222",
                      margin: 2,
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  const pageBackground = "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)";

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div>
      <h3
        style={{
          textAlign: "center",
          color: "#fff",
          fontWeight: 400,
          marginBottom: "32px",
          fontSize: "1.3rem",
          lineHeight: 1.6,
          background: "rgba(30,60,114,0.7)",
          padding: "18px 24px",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(30,60,114,0.15)",
        }}
      >
        In questa pagina il nostro{" "}
        <span
          style={{
            color: "#FFD700",
            fontWeight: 700,
            fontSize: "1.5rem",
            letterSpacing: "1px",
            textShadow: "0 2px 8px #222, 0 0 4px #FFD700",
          }}
        >
          DITTATORE
        </span>{" "}
        del gruppo Silv potrà lanciare un dado e decidere chi eliminare dal
        gruppo,
        <br />
        per poi procedere con l'eliminazione del malcapitato. Così da adempiere
        al suo arduo compito di incutere timore e terrore.
      </h3>
      <div style={{ ...styles.body, background: pageBackground }}>
        <div style={styles.container}>
          <div
            ref={diceRef}
            style={{
              ...styles.dice,
              cursor: canRoll ? "pointer" : "not-allowed",
              opacity: canRoll ? 1 : 0.5,
            }}
            onClick={handleClick}
            className="dice"
          >
            <div style={{ ...styles.diceFace, ...styles.front }}>
              {renderDots(1)}
            </div>
            <div style={{ ...styles.diceFace, ...styles.back }}>
              {renderDots(6)}
            </div>
            <div style={{ ...styles.diceFace, ...styles.right }}>
              {renderDots(3)}
            </div>
            <div style={{ ...styles.diceFace, ...styles.left }}>
              {renderDots(4)}
            </div>
            <div style={{ ...styles.diceFace, ...styles.top }}>
              {renderDots(2)}
            </div>
            <div style={{ ...styles.diceFace, ...styles.bottom }}>
              {renderDots(5)}
            </div>
          </div>
        </div>
        <div
          style={{
            ...styles.result,
            ...(showResult ? styles.resultShow : {}),
          }}
        >
          {result}
        </div>
        {!canRoll && (
          <div
            style={{
              color: "#fff",
              marginTop: "32px",
              fontSize: "1.2rem",
              background: "rgba(30,60,114,0.8)",
              padding: "12px 24px",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            Solo il Dittatore Silv può lanciare il dado.
          </div>
        )}
        <style>
          {`
              @keyframes roll {
                  0% { transform: rotateX(0deg) rotateY(0deg); }
                  100% { transform: rotateX(720deg) rotateY(720deg); }
              }
          `}
        </style>
      </div>
    </div>
  );
}