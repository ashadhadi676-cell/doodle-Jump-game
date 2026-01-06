import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rocket, Shield, Zap } from 'lucide-react';

const DoodleLeap = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('start'); // start, playing, gameOver
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const gameRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  // Sound effect functions
  const playSound = (type) => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch(type) {
      case 'jump':
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      
      case 'spring':
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
      
      case 'powerup':
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      
      case 'combo':
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1500, audioContext.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      
      case 'hit':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      
      case 'gameover':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        break;
    }
  };

  useEffect(() => {
    // Load high scores from storage
    const loadScores = async () => {
      try {
        const result = await window.storage.list('score:', true);
        if (result && result.keys) {
          const scores = await Promise.all(
            result.keys.map(async (key) => {
              const data = await window.storage.get(key, true);
              return data ? JSON.parse(data.value) : null;
            })
          );
          const validScores = scores.filter(s => s !== null).sort((a, b) => b.score - a.score).slice(0, 10);
          setLeaderboard(validScores);
          if (validScores.length > 0) {
            setHighScore(validScores[0].score);
          }
        }
      } catch (err) {
        console.log('No previous scores found');
      }
    };
    loadScores();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = 400;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    // Game state
    const game = {
      player: {
        x: width / 2 - 25,
        y: height - 150,
        width: 50,
        height: 50,
        velX: 0,
        velY: 0,
        jumping: false,
        jetpack: false,
        jetpackTime: 0,
        shield: false,
        shieldTime: 0
      },
      platforms: [],
      powerups: [],
      obstacles: [],
      scrollOffset: 0,
      combo: 0,
      lastPlatform: null,
      difficulty: 1,
      keys: { left: false, right: false }
    };

    gameRef.current = game;

    // Initialize platforms
    const initPlatforms = () => {
      game.platforms = [];
      // First platform directly under player
      game.platforms.push({
        x: width / 2 - 40,
        y: height - 100,
        width: 80,
        height: 12,
        type: 'normal'
      });
      // Rest of the platforms going up
      for (let i = 1; i < 8; i++) {
        game.platforms.push({
          x: Math.random() * (width - 80),
          y: height - i * 80 - 100,
          width: 80,
          height: 12,
          type: 'normal'
        });
      }
    };

    // Generate new platform
    const generatePlatform = (y) => {
      const types = ['normal', 'normal', 'normal', 'spring'];
      const type = types[Math.floor(Math.random() * types.length)];
      return {
        x: Math.random() * (width - 80),
        y: y,
        width: 80,
        height: type === 'spring' ? 16 : 12,
        type: type
      };
    };

    // Generate powerup
    const generatePowerup = (y) => {
      const types = ['jetpack', 'shield'];
      return {
        x: Math.random() * (width - 30),
        y: y,
        width: 30,
        height: 30,
        type: types[Math.floor(Math.random() * types.length)]
      };
    };

    // Generate obstacle
    const generateObstacle = (y) => {
      return {
        x: Math.random() * (width - 60),
        y: y,
        width: 60,
        height: 40,
        type: 'ufo',
        direction: Math.random() < 0.5 ? -1 : 1,
        speed: 1 + Math.random() * 1.5
      };
    };

    initPlatforms();

    // Draw functions
    const drawPlayer = () => {
      const p = game.player;
      
      // Shield effect
      if (p.shield) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x + p.width/2, p.y + p.height/2, p.width/2 + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Jetpack effect
      if (p.jetpack) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(p.x + 10, p.y + p.height - 5);
        ctx.lineTo(p.x + 5, p.y + p.height + 15);
        ctx.lineTo(p.x + 15, p.y + p.height + 10);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x + p.width - 10, p.y + p.height - 5);
        ctx.lineTo(p.x + p.width - 5, p.y + p.height + 15);
        ctx.lineTo(p.x + p.width - 15, p.y + p.height + 10);
        ctx.fill();
      }

      ctx.save();
      
      // Outer black outline
      ctx.strokeStyle = '#1a3a2e';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw doodle body outline (blob shape with nose)
      ctx.beginPath();
      ctx.moveTo(p.x + 8, p.y + 35);
      ctx.bezierCurveTo(p.x + 3, p.y + 20, p.x + 5, p.y + 8, p.x + 15, p.y + 3);
      ctx.bezierCurveTo(p.x + 25, p.y - 1, p.x + 35, p.y + 2, p.x + 42, p.y + 8);
      // Nose bump
      ctx.lineTo(p.x + 48, p.y + 12);
      ctx.lineTo(p.x + 52, p.y + 10);
      ctx.lineTo(p.x + 50, p.y + 15);
      ctx.bezierCurveTo(p.x + 48, p.y + 25, p.x + 47, p.y + 35, p.x + 43, p.y + 42);
      ctx.lineTo(p.x + 8, p.y + 42);
      ctx.closePath();
      
      // Yellow head gradient
      const gradient = ctx.createLinearGradient(p.x, p.y, p.x + 50, p.y + 25);
      gradient.addColorStop(0, '#ffeb3b');
      gradient.addColorStop(0.5, '#fdd835');
      gradient.addColorStop(1, '#f9a825');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.stroke();
      
      // Green body
      ctx.beginPath();
      ctx.moveTo(p.x + 8, p.y + 32);
      ctx.lineTo(p.x + 8, p.y + 50);
      ctx.lineTo(p.x + 43, p.y + 50);
      ctx.lineTo(p.x + 43, p.y + 32);
      ctx.closePath();
      
      const bodyGradient = ctx.createLinearGradient(p.x, p.y + 32, p.x + 43, p.y + 50);
      bodyGradient.addColorStop(0, '#4caf50');
      bodyGradient.addColorStop(0.5, '#388e3c');
      bodyGradient.addColorStop(1, '#2e7d32');
      ctx.fillStyle = bodyGradient;
      ctx.fill();
      ctx.stroke();
      
      // Shine on body
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(p.x + 15, p.y + 38, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(p.x + 18, p.y + 18, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x + 30, p.y + 18, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs
      ctx.strokeStyle = '#1a3a2e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x + 15, p.y + 50);
      ctx.lineTo(p.x + 15, p.y + 58);
      ctx.lineTo(p.x + 10, p.y + 58);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(p.x + 36, p.y + 50);
      ctx.lineTo(p.x + 36, p.y + 58);
      ctx.lineTo(p.x + 41, p.y + 58);
      ctx.stroke();
      
      ctx.restore();
    };

    const drawPlatform = (platform) => {
      ctx.save();
      
      if (platform.type === 'spring') {
        // Spring platform with gradient
        const gradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a6f');
        ctx.fillStyle = gradient;
        
        // Rounded platform
        ctx.beginPath();
        ctx.roundRect(platform.x, platform.y, platform.width, platform.height, 6);
        ctx.fill();
        
        // Soft shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        
        // Spring coils
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'transparent';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(platform.x + 20 + i * 20, platform.y + 8, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.roundRect(platform.x + 5, platform.y + 2, platform.width - 10, 4, 2);
        ctx.fill();
      } else {
        // Normal platform with gradient
        const gradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
        gradient.addColorStop(0, '#a78bfa');
        gradient.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = gradient;
        
        // Rounded platform
        ctx.beginPath();
        ctx.roundRect(platform.x, platform.y, platform.width, platform.height, 6);
        ctx.fill();
        
        // Soft shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        
        // Highlight
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.roundRect(platform.x + 5, platform.y + 2, platform.width - 10, 4, 2);
        ctx.fill();
      }
      
      ctx.restore();
    };

    const drawPowerup = (powerup) => {
      ctx.fillStyle = powerup.type === 'jetpack' ? '#fbbf24' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(powerup.x + 15, powerup.y + 15, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(powerup.type === 'jetpack' ? '🚀' : '🛡️', powerup.x + 15, powerup.y + 22);
    };

    const drawObstacle = (obstacle) => {
      // Moving UFO
      ctx.save();
      
      // UFO shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(obstacle.x + 30, obstacle.y + 35, 25, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // UFO body
      const gradient = ctx.createRadialGradient(obstacle.x + 30, obstacle.y + 20, 5, obstacle.x + 30, obstacle.y + 20, 25);
      gradient.addColorStop(0, '#a78bfa');
      gradient.addColorStop(0.6, '#8b5cf6');
      gradient.addColorStop(1, '#6d28d9');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(obstacle.x + 30, obstacle.y + 20, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // UFO outline
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // UFO dome
      const domeGradient = ctx.createRadialGradient(obstacle.x + 30, obstacle.y + 12, 2, obstacle.x + 30, obstacle.y + 12, 15);
      domeGradient.addColorStop(0, '#e9d5ff');
      domeGradient.addColorStop(0.7, '#c084fc');
      domeGradient.addColorStop(1, '#a855f7');
      ctx.fillStyle = domeGradient;
      ctx.beginPath();
      ctx.ellipse(obstacle.x + 30, obstacle.y + 12, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Lights on UFO
      const colors = ['#fbbf24', '#ef4444', '#22c55e'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.arc(obstacle.x + 15 + i * 15, obstacle.y + 22, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Shine effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(obstacle.x + 25, obstacle.y + 10, 8, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    };

    // Game loop
    const update = () => {
      const p = game.player;

      // Handle input
      if (game.keys.left) p.velX = -5;
      else if (game.keys.right) p.velX = 5;
      else p.velX *= 0.8;

      // Apply velocity
      p.x += p.velX;
      
      // Jetpack
      if (p.jetpack) {
        p.velY = -8;
        p.jetpackTime--;
        if (p.jetpackTime <= 0) p.jetpack = false;
      } else {
        p.velY += 0.5; // Gravity
      }
      
      p.y += p.velY;

      // Shield timer
      if (p.shield) {
        p.shieldTime--;
        if (p.shieldTime <= 0) p.shield = false;
      }

      // Wrap around screen
      if (p.x < -p.width) p.x = width;
      if (p.x > width) p.x = -p.width;

      // Platform collision
      if (p.velY > 0) {
        game.platforms.forEach(platform => {
          if (p.x < platform.x + platform.width &&
              p.x + p.width > platform.x &&
              p.y + p.height > platform.y &&
              p.y + p.height < platform.y + platform.height + 10) {
            
            if (platform !== game.lastPlatform) {
              game.combo++;
              const basePoints = 10;
              const comboBonus = Math.floor(game.combo / 3);
              const points = basePoints + comboBonus * 5;
              setScore(s => s + points);
              game.lastPlatform = platform;
              
              // Sound effects
              if (game.combo > 2 && game.combo % 3 === 0) {
                playSound('combo');
              }
            }

            if (platform.type === 'spring') {
              p.velY = -18;
              playSound('spring');
            } else {
              p.velY = -12;
              playSound('jump');
            }
            p.jumping = true;
          }
        });
      }

      // Powerup collision
      game.powerups = game.powerups.filter(powerup => {
        if (p.x < powerup.x + powerup.width &&
            p.x + p.width > powerup.x &&
            p.y < powerup.y + powerup.height &&
            p.y + p.height > powerup.y) {
          if (powerup.type === 'jetpack') {
            p.jetpack = true;
            p.jetpackTime = 180;
          } else if (powerup.type === 'shield') {
            p.shield = true;
            p.shieldTime = 300;
          }
          playSound('powerup');
          return false;
        }
        return true;
      });

      // Obstacle collision
      game.obstacles.forEach(obstacle => {
        // Move UFO horizontally
        obstacle.x += obstacle.direction * obstacle.speed;
        
        // Bounce off walls
        if (obstacle.x <= 0 || obstacle.x >= width - obstacle.width) {
          obstacle.direction *= -1;
        }
        
        if (p.x < obstacle.x + obstacle.width &&
            p.x + p.width > obstacle.x &&
            p.y < obstacle.y + obstacle.height &&
            p.y + p.height > obstacle.y) {
          if (!p.shield) {
            playSound('gameover');
            setGameState('gameOver');
          } else {
            p.shield = false;
            playSound('hit');
          }
        }
      });

      // Scroll world when player goes up
      if (p.y < height / 3) {
        const scroll = height / 3 - p.y;
        p.y = height / 3;
        game.scrollOffset += scroll;

        game.platforms.forEach(platform => platform.y += scroll);
        game.powerups.forEach(powerup => powerup.y += scroll);
        game.obstacles.forEach(obstacle => obstacle.y += scroll);

        // Remove off-screen platforms
        game.platforms = game.platforms.filter(platform => platform.y < height);
        game.powerups = game.powerups.filter(powerup => powerup.y < height);
        game.obstacles = game.obstacles.filter(obstacle => obstacle.y < height);

        // Generate new platforms
        while (game.platforms.length < 10) {
          const lastY = Math.min(...game.platforms.map(p => p.y));
          game.platforms.push(generatePlatform(lastY - 80));

          // Spawn powerups
          if (Math.random() < 0.1) {
            game.powerups.push(generatePowerup(lastY - 80));
          }

          // Spawn obstacles - very rare UFOs
          if (Math.random() < 0.03 * game.difficulty) {
            game.obstacles.push(generateObstacle(lastY - 80));
          }
        }

        game.difficulty = 1 + game.scrollOffset / 2000;
      }

      // Game over if fall off screen
      if (p.y > height) {
        playSound('gameover');
        setGameState('gameOver');
      }

      // Reset combo if missed platform
      if (p.velY > 5) {
        game.combo = 0;
        game.lastPlatform = null;
      }
    };

    const draw = () => {
      // Sky gradient background
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, '#87ceeb');
      skyGradient.addColorStop(0.5, '#b0d4f1');
      skyGradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      // Soft clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const cloudY = (game.scrollOffset % 300) - 100;
      
      // Cloud 1
      ctx.beginPath();
      ctx.arc(80, cloudY, 20, 0, Math.PI * 2);
      ctx.arc(100, cloudY, 25, 0, Math.PI * 2);
      ctx.arc(120, cloudY, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Cloud 2
      ctx.beginPath();
      ctx.arc(280, cloudY + 150, 18, 0, Math.PI * 2);
      ctx.arc(298, cloudY + 150, 22, 0, Math.PI * 2);
      ctx.arc(316, cloudY + 150, 18, 0, Math.PI * 2);
      ctx.fill();
      
      // Cloud 3
      ctx.beginPath();
      ctx.arc(180, cloudY + 80, 22, 0, Math.PI * 2);
      ctx.arc(200, cloudY + 80, 28, 0, Math.PI * 2);
      ctx.arc(220, cloudY + 80, 22, 0, Math.PI * 2);
      ctx.fill();

      // Draw platforms
      game.platforms.forEach(drawPlatform);
      
      // Draw powerups
      game.powerups.forEach(drawPowerup);
      
      // Draw obstacles
      game.obstacles.forEach(drawObstacle);
      
      // Draw player
      drawPlayer();

      // Draw combo
      if (game.combo > 2) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${game.combo}x COMBO!`, width/2, 40);
      }

      // Draw power-up indicators
      let indicatorX = 10;
      if (game.player.jetpack) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(indicatorX, 10, 30, 30);
        ctx.fillText('🚀', indicatorX + 15, 30);
        indicatorX += 40;
      }
      if (game.player.shield) {
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(indicatorX, 10, 30, 30);
        ctx.fillText('🛡️', indicatorX + 15, 30);
      }
    };

    let animationId;
    const gameLoop = () => {
      if (gameState === 'playing') {
        update();
        draw();
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    if (gameState === 'playing') {
      gameLoop();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [gameState]);

  const startGame = () => {
    setScore(0);
    setGameState('playing');
    if (gameRef.current) {
      gameRef.current.player = {
        x: 175,
        y: 450,
        width: 50,
        height: 50,
        velX: 0,
        velY: 0,
        jumping: false,
        jetpack: false,
        jetpackTime: 0,
        shield: false,
        shieldTime: 0
      };
      gameRef.current.scrollOffset = 0;
      gameRef.current.combo = 0;
      gameRef.current.difficulty = 1;
      gameRef.current.platforms = [];
      gameRef.current.powerups = [];
      gameRef.current.obstacles = [];
    }
  };

  const saveScore = async () => {
    if (score > 0) {
      const timestamp = Date.now();
      const scoreData = {
        score: score,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      };
      
      try {
        await window.storage.set(`score:${timestamp}`, JSON.stringify(scoreData), true);
        
        const newLeaderboard = [...leaderboard, scoreData]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        setLeaderboard(newLeaderboard);
        
        if (score > highScore) {
          setHighScore(score);
        }
      } catch (err) {
        console.error('Failed to save score:', err);
      }
    }
  };

  useEffect(() => {
    if (gameState === 'gameOver') {
      saveScore();
    }
  }, [gameState]);

  const handleTouchStart = useCallback((direction) => {
    if (gameRef.current) {
      gameRef.current.keys[direction] = true;
    }
  }, []);

  const handleTouchEnd = useCallback((direction) => {
    if (gameRef.current) {
      gameRef.current.keys[direction] = false;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameRef.current) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') gameRef.current.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') gameRef.current.keys.right = true;
      }
    };

    const handleKeyUp = (e) => {
      if (gameRef.current) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') gameRef.current.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') gameRef.current.keys.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="mb-4">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-500">
          Doodle Leap
        </h1>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="border-4 border-purple-500 rounded-lg shadow-2xl"
        />

        {gameState === 'start' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 bg-opacity-90 rounded-lg">
            <h2 className="text-4xl font-bold text-white mb-6">Doodle Leap</h2>
            <div className="text-white text-center mb-6 space-y-2">
              <p>🎮 Use Arrow Keys or A/D or On-Screen Buttons</p>
              <p>🚀 Collect Jetpacks for flight</p>
              <p>🛡️ Shields protect from obstacles</p>
              <p>⚡ Spring platforms = extra height</p>
              <p>🛸 Avoid moving UFOs!</p>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-purple-600 text-white text-2xl font-bold rounded-full hover:scale-110 transition-transform shadow-lg"
            >
              Start Game
            </button>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 bg-opacity-95 rounded-lg">
            <h2 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h2>
            <p className="text-3xl text-white mb-2">Score: {score}</p>
            <p className="text-xl text-yellow-400 mb-6">High Score: {highScore}</p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-purple-600 text-white text-2xl font-bold rounded-full hover:scale-110 transition-transform shadow-lg"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {gameState === 'playing' && (
        <div className="mt-4 text-center">
          <div className="text-3xl font-bold text-white mb-2">Score: {score}</div>
          <div className="flex gap-4 mt-4">
            <button
              onTouchStart={() => handleTouchStart('left')}
              onTouchEnd={() => handleTouchEnd('left')}
              onMouseDown={() => handleTouchStart('left')}
              onMouseUp={() => handleTouchEnd('left')}
              onMouseLeave={() => handleTouchEnd('left')}
              className="px-12 py-8 bg-purple-600 text-white text-2xl font-bold rounded-lg hover:bg-purple-700 active:bg-purple-800 shadow-lg"
            >
              ← LEFT
            </button>
            <button
              onTouchStart={() => handleTouchStart('right')}
              onTouchEnd={() => handleTouchEnd('right')}
              onMouseDown={() => handleTouchStart('right')}
              onMouseUp={() => handleTouchEnd('right')}
              onMouseLeave={() => handleTouchEnd('right')}
              className="px-12 py-8 bg-green-600 text-white text-2xl font-bold rounded-lg hover:bg-green-700 active:bg-green-800 shadow-lg"
            >
              RIGHT →
            </button>
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="mt-6 bg-slate-800 p-4 rounded-lg w-full max-w-md">
          <h3 className="text-2xl font-bold text-yellow-400 mb-3 text-center">🏆 Leaderboard</h3>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div key={index} className="flex justify-between text-white bg-slate-700 p-2 rounded">
                <span className="font-bold">#{index + 1}</span>
                <span>{entry.score} pts</span>
                <span className="text-sm text-gray-400">{entry.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DoodleLeap;
