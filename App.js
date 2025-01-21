import React, { useEffect, useRef, useState } from "react";

function MotionAndSoundTrigger() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  // Состояния обнаружения движения и звука
  const [isMotionDetected, setIsMotionDetected] = useState(false);
  const [isSoundDetected, setIsSoundDetected] = useState(false);

  // Сообщение об ошибке при работе с микрофоном
  const [micError, setMicError] = useState("");

  // Параметры чувствительности
  const [sensitivity, setSensitivity] = useState({
    motion: 50, // порог для движения
    sound: 30, // порог для звука
  });

  // Флаги для включения обнаружения
  const [tracking, setTracking] = useState({ motion: true, sound: true });

  const [lastTriggerTime, setLastTriggerTime] = useState(0);

  // Время паузы для повторного открытия сайта (5 минут)
  const triggerCooldown = 5 * 60 * 1000; // 5 минут в мс

  // Сайт, который открывается при срабатывании
  const targetURL = "https://orlenok777.github.io/oitodo";

  // Волшебные фразы
  const magicPhrases = ["напомни мне", "спасибо"];

  // Состояние для отображения таймера до следующего триггера
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // ==========================
  //      ВСПОМОГАТЕЛЬНЫЕ
  // ==========================

  // Функция озвучивания сообщения и открытия сайта
  const speakAndTrigger = (message) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = "ru-RU";
      window.speechSynthesis.speak(utterance);
    }
    // Открываем сайт через 1 секунду, чтобы дать время произнести сообщение
    setTimeout(() => {
      window.open(targetURL, "_blank");
    }, 1000);
  };

  // Функция триггера по типу события ('sound', 'motion' или 'magic')
  const triggerAction = (type) => {
    const now = Date.now();

    // Проверяем, не активен ли «охладитель» (cooldown)
    if (now - lastTriggerTime < triggerCooldown) {
      console.log("Триггер ещё на перезарядке!");
      return;
    }

    // Обновляем время последнего срабатывания
    setLastTriggerTime(now);

    // Запускаем действие
    switch (type) {
      case "sound":
        speakAndTrigger("Я вас слышу и переношу вас на сайт");
        break;
      case "motion":
        speakAndTrigger("Я вас вижу и переношу вас на сайт");
        break;
      case "magic":
        speakAndTrigger("Волшебная фраза обнаружена. Переношу вас на сайт");
        break;
      default:
        break;
    }
  };

  // Проверка на волшебные фразы
  const checkForMagicPhrases = (transcript) => {
    const lowerCaseTranscript = transcript.toLowerCase();
    return magicPhrases.some((phrase) => lowerCaseTranscript.includes(phrase));
  };

  // ==========================
  //      НАСТРОЙКА КАМЕРЫ
  // ==========================

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Ошибка доступа к камере:", err);
      }
    }
    setupCamera();
  }, []);

  // ==========================
  //  ОБНАРУЖЕНИЕ ДВИЖЕНИЯ (via requestAnimationFrame)
  // ==========================

  useEffect(() => {
    if (!tracking.motion) return;

    let previousFrame = null;
    let animationFrameId;

    const analyzeFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState !== 4) {
        animationFrameId = requestAnimationFrame(analyzeFrame);
        return;
      }

      const context = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const currentFrame = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      if (previousFrame) {
        let motionDetected = false;

        for (let i = 0; i < currentFrame.data.length; i += 4) {
          const diff =
            Math.abs(currentFrame.data[i] - previousFrame.data[i]) +
            Math.abs(currentFrame.data[i + 1] - previousFrame.data[i + 1]) +
            Math.abs(currentFrame.data[i + 2] - previousFrame.data[i + 2]);

          if (diff > sensitivity.motion) {
            motionDetected = true;
            break;
          }
        }

        if (motionDetected && !isMotionDetected) {
          triggerAction("motion");
          setIsMotionDetected(true);
        } else if (!motionDetected) {
          setIsMotionDetected(false);
        }
      }

      previousFrame = currentFrame;
      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    animationFrameId = requestAnimationFrame(analyzeFrame);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [tracking.motion, sensitivity.motion, isMotionDetected, lastTriggerTime]);

  // ==========================
  //   ОБНАРУЖЕНИЕ ЗВУКА
  // ==========================

  useEffect(() => {
    if (!tracking.sound) return;

    let intervalId;

    async function setupMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const detectSound = () => {
          analyser.getByteFrequencyData(dataArray);
          const average =
            dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

          if (average > sensitivity.sound && !isSoundDetected) {
            triggerAction("sound");
            setIsSoundDetected(true);
          } else if (average <= sensitivity.sound) {
            setIsSoundDetected(false);
          }
        };

        intervalId = setInterval(detectSound, 200);
      } catch (err) {
        console.error("Ошибка доступа к микрофону:", err);
        setMicError(
          "Нет доступа к микрофону. Пожалуйста, проверьте настройки."
        );
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(
            "Я вас не слышал, наверное, камера не работает или микрофон"
          );
          utterance.lang = "ru-RU";
          window.speechSynthesis.speak(utterance);
        }
      }
    }
    setupMicrophone();

    return () => {
      clearInterval(intervalId);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [tracking.sound, sensitivity.sound, isSoundDetected, lastTriggerTime]);

  // ==========================
  //   РАСПОЗНАВАНИЕ РЕЧИ
  // ==========================

  useEffect(() => {
    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      console.warn("Этот браузер не поддерживает SpeechRecognition.");
      return;
    }

    // Создаём экземпляр распознавания речи
    const recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.lang = "ru-RU";
    recognition.continuous = true; // слушаем непрерывно
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[event.resultIndex][0].transcript;
      console.log("Распознанная речь:", transcript);

      if (checkForMagicPhrases(transcript)) {
        triggerAction("magic");
      }
    };

    recognition.onerror = (e) => {
      console.error("Ошибка в распознавании речи:", e);
    };

    recognition.onend = () => {
      // Если распознавание автоматически остановилось, запускаем снова
      recognition.start();
    };

    recognition.start();

    return () => {
      recognition.stop();
    };
  }, [lastTriggerTime]);

  // ==========================
  //   ОТЛИЧИТЕЛЬНАЯ ЛОГИКА
  //  (ОБРАТНЫЙ ОТСЧЁТ ДО НОВОГО ТРИГГЕРА)
  // ==========================

  useEffect(() => {
    // Каждую секунду обновляем оставшееся время «перезарядки»
    const timerId = setInterval(() => {
      const now = Date.now();
      const timeSinceLastTrigger = now - lastTriggerTime;
      const remaining = triggerCooldown - timeSinceLastTrigger;

      if (remaining > 0) {
        setCooldownRemaining(Math.ceil(remaining / 1000)); // в секундах
      } else {
        setCooldownRemaining(0);
      }
    }, 1000);

    return () => clearInterval(timerId);
  }, [lastTriggerTime]);

  // ==========================
  //           UI
  // ==========================

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px" }}>
      <h1>Motion and Sound Trigger (улучшенная версия)</h1>
      <p>
        При обнаружении <strong>звука</strong>: программа скажет «Я вас слышу и
        переношу вас на сайт» и откроет сайт.
      </p>
      <p>
        При обнаружении <strong>движения</strong>: программа скажет «Я вас вижу
        и переношу вас на сайт» и откроет сайт.
      </p>
      <p>
        Если микрофон недоступен, прозвучит фраза: «Я вас не слышал, наверное,
        камера не работает или микрофон».
      </p>
      <p>
        Также работает <strong>распознавание речи</strong>: при произнесении
        волшебных слов (<em>«напомни мне»</em>, <em>«спасибо»</em>) сработает
        триггер.
      </p>

      {micError && (
        <p style={{ color: "red" }}>
          <strong>Ошибка микрофона:</strong> {micError}
        </p>
      )}

      {/* Скрытые видео и canvas для отслеживания движения */}
      <video ref={videoRef} style={{ display: "none" }}></video>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

      <div style={{ marginTop: "20px" }}>
        <p>
          {isMotionDetected ? (
            <span style={{ color: "red" }}>Движение обнаружено!</span>
          ) : (
            "Движение не обнаружено."
          )}
        </p>
        <p>
          {isSoundDetected ? (
            <span style={{ color: "blue" }}>Звук обнаружен!</span>
          ) : (
            "Звук не обнаружен."
          )}
        </p>
      </div>

      <div style={{ marginTop: "20px" }}>
        {cooldownRemaining > 0 ? (
          <p>
            Триггер перезаряжается. Повторная активация будет доступна через{" "}
            <strong>{cooldownRemaining} сек.</strong>
          </p>
        ) : (
          <p>Триггер готов к срабатыванию!</p>
        )}
      </div>

      {/* Управление чувствительностью */}
      <div style={{ marginTop: "20px" }}>
        <h3>Настройки обнаружения:</h3>
        <div style={{ marginBottom: "10px" }}>
          <label>
            Чувствительность движения: {sensitivity.motion}
            <br />
            <input
              type="range"
              min="0"
              max="255"
              value={sensitivity.motion}
              onChange={(e) =>
                setSensitivity({
                  ...sensitivity,
                  motion: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <div>
          <label>
            Чувствительность звука: {sensitivity.sound}
            <br />
            <input
              type="range"
              min="0"
              max="255"
              value={sensitivity.sound}
              onChange={(e) =>
                setSensitivity({
                  ...sensitivity,
                  sound: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default MotionAndSoundTrigger;
