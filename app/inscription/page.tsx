<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>En savoir plus - RIUSC</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: #1a1a2e;
            background: #ffffff;
        }
        
        /* Header */
        .header {
            background: white;
            padding: 16px 0;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            box-shadow: 0 2px 20px rgba(0,0,0,0.08);
        }
        
        .header-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 16px;
            text-decoration: none;
        }
        
        .logo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
        }
        
        .logo-text {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a5f;
        }
        
        .header-nav {
            display: flex;
            align-items: center;
            gap: 24px;
        }
        
        .header-nav a {
            text-decoration: none;
            color: #374151;
            font-weight: 500;
            font-size: 15px;
            transition: color 0.2s;
        }
        
        .header-nav a:hover {
            color: #1e3a5f;
        }
        
        .btn-reserviste {
            background: #1e3a5f;
            color: white !important;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            transition: background 0.2s;
        }
        
        .btn-reserviste:hover {
            background: #2d4a6f !important;
        }
        
        /* Page Header */
        .page-header {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #3d5a80 100%);
            padding: 160px 24px 80px;
            position: relative;
            overflow: hidden;
        }
        
        .page-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/></svg>');
            background-size: 100px 100px;
        }
        
        .page-header-container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
            padding-left: 48px;
        }
        
        .breadcrumb {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
        }
        
        .breadcrumb a {
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            font-size: 14px;
        }
        
        .breadcrumb a:hover {
            color: white;
        }
        
        .breadcrumb span {
            color: rgba(255,255,255,0.5);
        }
        
        .breadcrumb-current {
            color: white !important;
        }
        
        .page-header h1 {
            color: white;
            font-size: clamp(32px, 4vw, 48px);
            font-weight: 800;
            margin-bottom: 16px;
        }
        
        .page-header p {
            color: rgba(255,255,255,0.85);
            font-size: 18px;
            max-width: 700px;
        }
        
        /* Content Sections */
        .content-section {
            padding: 80px 24px;
        }
        
        .content-section.alt {
            background: #f8fafc;
        }
        
        .content-container {
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .section-header {
            text-align: center;
            margin-bottom: 50px;
        }
        
        .section-tag {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 6px 16px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .section-title {
            font-size: clamp(28px, 4vw, 38px);
            font-weight: 800;
            color: #1e3a5f;
            margin-bottom: 16px;
        }
        
        .section-subtitle {
            color: #6b7280;
            font-size: 17px;
            max-width: 700px;
            margin: 0 auto;
        }
        
        /* Text Content */
        .text-content {
            font-size: 16px;
            color: #4b5563;
            line-height: 1.8;
        }
        
        .text-content h2 {
            font-size: 24px;
            font-weight: 700;
            color: #1e3a5f;
            margin: 40px 0 16px;
        }
        
        .text-content h2:first-child {
            margin-top: 0;
        }
        
        .text-content p {
            margin-bottom: 16px;
        }
        
        .text-content ul {
            margin: 16px 0;
            padding-left: 0;
            list-style: none;
        }
        
        .text-content li {
            padding: 10px 0 10px 32px;
            position: relative;
        }
        
        .text-content li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #10b981;
            font-weight: bold;
            font-size: 18px;
        }

        /* Criteria Section */
        .criteria-section {
            padding: 80px 24px;
            background: #f8fafc;
        }

        .criteria-container {
            max-width: 1000px;
            margin: 0 auto;
        }

        .criteria-box {
            background: white;
            border-radius: 16px;
            padding: 48px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            border: 1px solid #e5e7eb;
        }

        .criteria-box h2 {
            font-size: 28px;
            font-weight: 800;
            color: #1e3a5f;
            margin-bottom: 8px;
        }

        .criteria-box > p {
            color: #6b7280;
            font-size: 16px;
            margin-bottom: 32px;
            line-height: 1.7;
        }

        .criteria-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .criteria-item {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s;
        }

        .criteria-item:hover {
            border-color: #1e3a5f;
            box-shadow: 0 4px 16px rgba(30,58,95,0.08);
        }

        .criteria-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #1e3a5f, #3d5a80);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 18px;
        }

        .criteria-item-text {
            font-size: 15px;
            color: #374151;
            font-weight: 500;
            line-height: 1.5;
        }

        .criteria-note {
            background: #eef7ff;
            border-left: 4px solid #1e3a5f;
            border-radius: 0 12px 12px 0;
            padding: 20px 24px;
            color: #374151;
            font-size: 15px;
            line-height: 1.7;
        }

        .criteria-note strong {
            color: #1e3a5f;
        }
        
        /* Gallery Section */
        .gallery-section {
            padding: 80px 24px;
            background: #f8fafc;
        }
        
        .gallery-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
        }
        
        .gallery-item {
            position: relative;
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            transition: all 0.3s;
            height: 220px;
        }
        
        .gallery-item:hover {
            transform: scale(1.02);
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        
        .gallery-item:hover .gallery-overlay {
            opacity: 1;
        }
        
        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s;
        }
        
        .gallery-item:hover img {
            transform: scale(1.05);
        }
        
        .gallery-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(30, 58, 95, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .gallery-overlay svg {
            width: 40px;
            height: 40px;
            color: white;
        }
        
        .gallery-item.featured {
            grid-column: span 2;
        }
        
        /* Lightbox */
        .lightbox {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2000;
            align-items: center;
            justify-content: center;
            padding: 40px;
        }
        
        .lightbox.active {
            display: flex;
        }
        
        .lightbox-content {
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
        }
        
        .lightbox-content img {
            max-width: 100%;
            max-height: 85vh;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        
        .lightbox-close {
            position: absolute;
            top: -50px;
            right: 0;
            background: none;
            border: none;
            color: white;
            font-size: 40px;
            cursor: pointer;
            padding: 10px;
            transition: transform 0.2s;
        }
        
        .lightbox-close:hover {
            transform: scale(1.1);
        }
        
        .lightbox-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .lightbox-nav:hover {
            background: rgba(255,255,255,0.2);
        }
        
        .lightbox-prev {
            left: -70px;
        }
        
        .lightbox-next {
            right: -70px;
        }
        
        .lightbox-counter {
            position: absolute;
            bottom: -40px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255,255,255,0.7);
            font-size: 14px;
        }
        
        /* Tour Section */
        .tour-section {
            padding: 80px 24px;
            background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%);
        }
        
        .tour-container {
            max-width: 1100px;
            margin: 0 auto;
        }
        
        .tour-header {
            text-align: center;
            margin-bottom: 50px;
        }
        
        .tour-header .section-tag {
            background: rgba(255,255,255,0.2);
            color: white;
        }
        
        .tour-header h2 {
            color: white;
            font-size: clamp(28px, 4vw, 38px);
            font-weight: 800;
            margin-bottom: 16px;
        }
        
        .tour-header p {
            color: rgba(255,255,255,0.85);
            font-size: 17px;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .year-divider {
            text-align: center;
            margin: 32px 0 24px;
            position: relative;
        }
        
        .year-divider::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            top: 50%;
            height: 1px;
            background: rgba(255,255,255,0.2);
        }
        
        .year-divider span {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%);
            padding: 8px 24px;
            font-size: 18px;
            font-weight: 700;
            color: white;
            position: relative;
            border-radius: 50px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .tour-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
        }
        
        .tour-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
            display: block;
            text-decoration: none;
        }
        
        .tour-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        
        .tour-card.past {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .tour-card.past::after {
            content: 'Terminé';
            position: absolute;
            top: 12px;
            right: -28px;
            background: #6b7280;
            color: white;
            padding: 4px 36px;
            font-size: 11px;
            font-weight: 600;
            transform: rotate(45deg);
        }
        
        .tour-card .city {
            font-size: 18px;
            font-weight: 700;
            color: #1e3a5f;
            margin-bottom: 6px;
        }
        
        .tour-card .dates {
            font-size: 14px;
            color: #6b7280;
        }

        .tour-card .location {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 8px;
            font-style: italic;
        }

        .tour-card .tour-cta {
            margin-top: 12px;
            font-size: 13px;
            font-weight: 600;
            color: #e63946;
            opacity: 0;
            transition: opacity 0.3s;
        }

        .tour-card:not(.past):hover .tour-cta {
            opacity: 1;
        }

        .tour-card:not(.past) {
            cursor: pointer;
            border: 2px solid transparent;
        }

        .tour-card:not(.past):hover {
            border-color: #e63946;
        }
        
        .tour-note {
            text-align: center;
            margin-top: 40px;
            padding: 24px;
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
        }
        
        .tour-note p {
            color: rgba(255,255,255,0.9);
            font-size: 15px;
            margin-bottom: 16px;
        }
        
        .tour-note a {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #e63946;
            color: white;
            padding: 14px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .tour-note a:hover {
            background: #d62839;
            transform: translateY(-2px);
        }
        
        /* Partners */
        .partners-section {
            padding: 80px 24px;
            background: white;
        }
        
        .partners-container {
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .partners-intro {
            max-width: 800px;
            margin: 0 auto 50px;
        }
        
        .partners-intro p {
            color: #4b5563;
            font-size: 16px;
            line-height: 1.8;
            text-align: center;
        }
        
        .partners-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 24px;
        }
        
        .partner-card {
            background: #f8fafc;
            border-radius: 16px;
            padding: 32px 24px;
            text-align: center;
            text-decoration: none;
            transition: all 0.3s;
            border: 1px solid #e5e7eb;
        }
        
        .partner-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.1);
            border-color: #1e3a5f;
        }
        
        .partner-card img {
            height: 60px;
            margin-bottom: 16px;
            opacity: 0.9;
            transition: opacity 0.3s;
        }
        
        .partner-card:hover img {
            opacity: 1;
        }
        
        .partner-card h4 {
            font-size: 16px;
            font-weight: 600;
            color: #1e3a5f;
            margin-bottom: 8px;
        }
        
        .partner-card p {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.5;
        }
        
        /* CTA */
        .cta {
            padding: 80px 24px;
            background: #f8fafc;
            text-align: center;
        }
        
        .cta-container {
            max-width: 700px;
            margin: 0 auto;
        }
        
        .cta h2 {
            font-size: clamp(28px, 4vw, 38px);
            font-weight: 800;
            color: #1e3a5f;
            margin-bottom: 16px;
        }
        
        .cta p {
            color: #6b7280;
            font-size: 17px;
            margin-bottom: 32px;
        }
        
        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #e63946;
            color: white;
            padding: 18px 36px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 700;
            font-size: 17px;
            transition: all 0.3s;
            box-shadow: 0 4px 20px rgba(230,57,70,0.4);
        }
        
        .btn-primary:hover {
            background: #d62839;
            transform: translateY(-2px);
            box-shadow: 0 6px 30px rgba(230,57,70,0.5);
        }
        
        /* Footer */
        .footer {
            background: #1a1a2e;
            color: white;
            padding: 60px 24px 30px;
        }
        
        .footer-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .footer-top {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 40px;
            padding-bottom: 40px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .footer-col h4 {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 20px;
        }
        
        .footer-col p, .footer-col a {
            color: rgba(255,255,255,0.7);
            font-size: 14px;
            line-height: 1.8;
            text-decoration: none;
        }
        
        .footer-col a:hover {
            color: white;
        }
        
        .footer-col ul {
            list-style: none;
        }
        
        .footer-col li {
            margin-bottom: 12px;
        }
        
        .footer-bottom {
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .footer-bottom p {
            color: rgba(255,255,255,0.5);
            font-size: 14px;
        }
        
        .footer-links {
            display: flex;
            gap: 24px;
        }
        
        .footer-links a {
            color: rgba(255,255,255,0.5);
            font-size: 14px;
            text-decoration: none;
        }
        
        .footer-links a:hover {
            color: white;
        }
        
        /* Mobile Menu Button */
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            z-index: 1001;
            -webkit-tap-highlight-color: transparent;
        }
        
        .mobile-menu-btn span {
            display: block;
            width: 24px;
            height: 2px;
            background: #1e3a5f;
            margin: 6px 0;
            transition: all 0.3s ease;
            transform-origin: center;
        }

        .mobile-menu-btn.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 6px);
        }

        .mobile-menu-btn.active span:nth-child(2) {
            opacity: 0;
        }

        .mobile-menu-btn.active span:nth-child(3) {
            transform: rotate(-45deg) translate(5px, -6px);
        }

        .mobile-nav-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 998;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .mobile-nav-overlay.active {
            opacity: 1;
        }
        
        @media (max-width: 968px) {
            .gallery-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .gallery-item.featured {
                grid-column: span 1;
            }
            
            .lightbox-prev {
                left: 10px;
            }
            
            .lightbox-next {
                right: 10px;
            }
        }
        
        @media (max-width: 768px) {
            .header-nav {
                display: flex;
                flex-direction: column;
                position: fixed;
                top: 0;
                right: -100%;
                width: 85%;
                max-width: 360px;
                height: 100vh;
                background: white;
                padding: 100px 28px 40px;
                gap: 0;
                box-shadow: -5px 0 30px rgba(0,0,0,0.15);
                z-index: 999;
                transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                overflow-y: auto;
            }

            .header-nav.active {
                right: 0;
            }

            .header-nav a {
                display: block;
                padding: 16px 0;
                font-size: 17px;
                font-weight: 600;
                color: #1e3a5f !important;
                border-bottom: 1px solid #f0f0f0;
            }

            .header-nav a:last-child {
                border-bottom: none;
            }

            .header-nav .btn-reserviste {
                margin-top: 20px;
                text-align: center;
                padding: 16px 24px;
                border-radius: 10px;
                font-size: 16px;
                color: white !important;
            }
            
            .mobile-menu-btn {
                display: block;
            }

            .mobile-nav-overlay {
                display: block;
                pointer-events: none;
            }

            .mobile-nav-overlay.active {
                pointer-events: auto;
            }
            
            .page-header {
                padding: 140px 24px 60px;
            }
            
            .page-header-container {
                padding-left: 0;
            }
            
            .gallery-grid {
                grid-template-columns: 1fr 1fr;
            }
            
            .gallery-item {
                height: 180px;
            }
            
            .tour-grid {
                grid-template-columns: 1fr 1fr;
            }
            
            .partners-grid {
                grid-template-columns: 1fr 1fr;
            }

            .criteria-box {
                padding: 28px 20px;
            }

            .criteria-grid {
                grid-template-columns: 1fr;
            }
        }
        
        @media (max-width: 500px) {
            .gallery-grid {
                grid-template-columns: 1fr;
            }
            
            .gallery-item {
                height: 220px;
            }
            
            .tour-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-container">
            <a href="https://www.riusc.ca/" class="logo-section">
                <img src="http://www.riusc.ca/wp-content/uploads/2025/12/cropped-LogoRiucs_200.webp" alt="Logo RIUSC" class="logo">
                <div class="logo-text">RIUSC</div>
            </a>
            <nav class="header-nav" id="headerNav">
                <a href="https://www.riusc.ca/">Accueil</a>
                <a href="https://www.riusc.ca/en-savoir-plus/" style="color: #1e3a5f; font-weight: 600;">En savoir plus</a>
                <a href="#tournee">Tournée des camps</a>
                <a href="https://portail.riusc.ca/login" class="btn-reserviste" target="_blank">Espace Réserviste</a>
            </nav>
            <button class="mobile-menu-btn" id="menuBtn" aria-label="Ouvrir le menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </div>
    </header>

    <!-- Mobile overlay -->
    <div class="mobile-nav-overlay" id="navOverlay"></div>

    <!-- Page Header -->
    <section class="page-header">
        <div class="page-header-container">
            <div class="breadcrumb">
                <a href="https://www.riusc.ca/">Accueil</a>
                <span>›</span>
                <span class="breadcrumb-current">En savoir plus</span>
            </div>
            <h1>Qu'est-ce que la RIUSC?</h1>
            <p>
                Découvrez comment la Réserve d'intervention d'urgence en sécurité civile 
                renforce la capacité du Québec à répondre aux sinistres majeurs.
            </p>
        </div>
    </section>

    <!-- About Section -->
    <section class="content-section">
        <div class="content-container">
            <div class="text-content">
                <h2>Une mesure exceptionnelle de la réponse gouvernementale</h2>
                <p>
                    La RIUSC est une mesure exceptionnelle de la réponse gouvernementale aux sinistres.
                </p>
                <p>
                    Les municipalités sont les premières responsables de la réponse aux sinistres sur leur territoire. 
                    Si leurs effectifs deviennent insuffisants pour gérer les conséquences ou pour prendre en charge 
                    les personnes sinistrées, elles peuvent, en dernier recours, demander le déploiement de la RIUSC.
                </p>
                <p>
                    À long terme, la RIUSC pourra promouvoir l'établissement d'une résilience communautaire 
                    aux échelles municipale et régionale, en conformité avec l'esprit de la 
                    <em>Loi sur la sécurité civile visant à favoriser la résilience aux sinistres</em> (LSCRS).
                </p>
                
                <h2>Mandat de la RIUSC</h2>
                <p>
                    La RIUSC a le mandat de rehausser les capacités opérationnelles des municipalités lors de sinistres.
                    Elle permet d'offrir une réponse sur le terrain grâce à des intervenants qualifiés qui agissent 
                    principalement dans deux types de tâches :
                </p>
                <ul>
                    <li>Le soutien aux opérations sur le terrain (travaux de protection, soutien logistique, corvées de nettoyage, reconnaissance du territoire)</li>
                    <li>Le soutien aux personnes sinistrées et aux populations vulnérables (évacuations, hébergement, alimentation, besoins essentiels)</li>
                </ul>
                <p>
                    Les intervenants de la RIUSC sont prêts à être déployés rapidement sur l'ensemble du territoire québécois. 
                    Issus d'organisations dotées de capacités opérationnelles et engagées en sécurité civile, 
                    ils sont qualifiés, c'est-à-dire formés, exercés et équipés.
                </p>
            </div>
        </div>
    </section>

    <!-- Criteria Section -->
    <section class="criteria-section">
        <div class="criteria-container">
            <div class="criteria-box">
                <span class="section-tag" style="margin-bottom: 20px;">Rejoignez-nous</span>
                <h2>Vous souhaitez intervenir au sein de la RIUSC?</h2>
                <p>Voici les critères de base pour devenir réserviste :</p>

                <div class="criteria-grid">
                    <div class="criteria-item">
                        <div class="criteria-icon">🎂</div>
                        <div class="criteria-item-text">Avoir au moins <strong>18 ans</strong></div>
                    </div>
                    <div class="criteria-item">
                        <div class="criteria-icon">💪</div>
                        <div class="criteria-item-text">Être en <strong>bonne forme physique</strong> (pour certaines tâches)</div>
                    </div>
                    <div class="criteria-item">
                        <div class="criteria-icon">✅</div>
                        <div class="criteria-item-text">Ne pas avoir d'<strong>antécédents judiciaires</strong></div>
                    </div>
                    <div class="criteria-item">
                        <div class="criteria-icon">📚</div>
                        <div class="criteria-item-text">Être prêt à suivre le <strong>programme de formation</strong></div>
                    </div>
                </div>

                <div class="criteria-note">
                    <strong>Transparence et consentement éclairé :</strong> Les modalités d'engagement sont communiquées avant chaque mobilisation. Le rôle proposé, l'encadrement et les mesures de sécurité vous sont présentés de façon transparente afin que vous puissiez accepter ou refuser en connaissance de cause.
                </div>
            </div>
        </div>
    </section>

    <!-- Gallery Section -->
    <section class="gallery-section">
        <div class="gallery-container">
            <div class="section-header">
                <span class="section-tag">En images</span>
                <h2 class="section-title">Nos camps de qualification</h2>
                <p class="section-subtitle">
                    Découvrez en photos les camps de qualification où nos réservistes 
                    développent leurs compétences pratiques en sécurité civile.
                </p>
            </div>
            
            <div class="gallery-grid">
                <div class="gallery-item featured" onclick="openLightbox(0)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/RIUSC-Laval.jpg" alt="Camp RIUSC Laval" loading="lazy">
                    <div class="gallery-overlay">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                    </div>
                </div>
                <div class="gallery-item" onclick="openLightbox(1)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20250222_135935024-scaled.jpg" alt="Formation terrain" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(2)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9519-scaled.jpg" alt="Exercice pratique" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(3)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20250322_144352379-scaled.jpg" alt="Travail d'équipe" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item featured" onclick="openLightbox(4)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20250329_152936417-scaled.jpg" alt="Groupe de réservistes" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(5)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20260131_140444341-1-scaled.jpg" alt="Formation pratique" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(6)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9542-scaled.jpg" alt="Atelier en équipe" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(7)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9557-scaled.jpg" alt="Formation en salle" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(8)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9354-scaled.jpg" alt="Exercice terrain" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
                <div class="gallery-item" onclick="openLightbox(9)">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20260201_185258805-1-scaled.jpg" alt="Exercice de simulation" loading="lazy">
                    <div class="gallery-overlay"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
                </div>
            </div>
        </div>
    </section>

    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
        <div class="lightbox-content">
            <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
            <button class="lightbox-nav lightbox-prev" onclick="navigateLightbox(-1)">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <img id="lightbox-img" src="" alt="Photo agrandie">
            <button class="lightbox-nav lightbox-next" onclick="navigateLightbox(1)">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="lightbox-counter" id="lightbox-counter"></div>
        </div>
    </div>

    <!-- Tour Section -->
    <section class="tour-section" id="tournee">
        <div class="tour-container">
            <div class="tour-header">
                <span class="section-tag">Tournée des camps</span>
                <h2>Camps de qualification près de chez vous</h2>
                <p>
                    Nous parcourons le Québec pour offrir des camps de qualification pratique 
                    dans plusieurs régions. Inscrivez-vous à la RIUSC pour participer !
                </p>
            </div>
            
            <!-- Camps 2025 -->
            <div class="year-divider">
                <span>2025</span>
            </div>
            
            <div class="tour-grid">
                <div class="tour-card past">
                    <div class="city">Québec</div>
                    <div class="dates">21 - 22 février 2025</div>
                </div>
                <div class="tour-card past">
                    <div class="city">Saint-Jean-sur-Richelieu</div>
                    <div class="dates">14 - 15 mars 2025</div>
                </div>
                <div class="tour-card past">
                    <div class="city">Québec</div>
                    <div class="dates">21 - 22 mars 2025</div>
                </div>
                <div class="tour-card past">
                    <div class="city">Trois-Rivières</div>
                    <div class="dates">28 - 29 mars 2025</div>
                </div>
                <div class="tour-card past">
                    <div class="city">Québec</div>
                    <div class="dates">29 - 30 novembre 2025</div>
                </div>
            </div>
            
            <!-- Camps 2026 -->
            <div class="year-divider">
                <span>2026</span>
            </div>
            
            <div class="tour-grid">
                <div class="tour-card past">
                    <div class="city">Laval</div>
                    <div class="dates">31 janvier - 1er février 2026</div>
                </div>

                <div class="tour-card past">
                    <div class="city">Trois-Rivières</div>
                    <div class="dates">21 - 22 février 2026</div>
                </div>
                
                <a href="https://portail.riusc.ca/inscription?camp=CAMP_STE_CATHERINE_MAR26" class="tour-card" target="_blank">
                    <div class="city">Sainte-Catherine</div>
                    <div class="dates">14 - 15 mars 2026</div>
                    <div class="location">Centre Municipal Aimé-Guérin</div>
                    <div class="tour-cta">S'inscrire →</div>
                </a>
                
                <a href="https://portail.riusc.ca/inscription?camp=CAMP_CHICOUTIMI_AVR26" class="tour-card" target="_blank">
                    <div class="city">Chicoutimi</div>
                    <div class="dates">25 - 26 avril 2026</div>
                    <div class="location">Hôtel Chicoutimi</div>
                    <div class="tour-cta">S'inscrire →</div>
                </a>
                
                <a href="https://portail.riusc.ca/inscription?camp=CAMP_QUEBEC_MAI26" class="tour-card" target="_blank">
                    <div class="city">Québec</div>
                    <div class="dates">23 - 24 mai 2026</div>
                    <div class="location">Résidences Campus Notre-Dame-De-Foy</div>
                    <div class="tour-cta">S'inscrire →</div>
                </a>
                
                <a href="https://portail.riusc.ca/inscription?camp=CAMP_RIMOUSKI_SEP26" class="tour-card" target="_blank">
                    <div class="city">Rimouski</div>
                    <div class="dates">26 - 27 septembre 2026</div>
                    <div class="location">Site à définir</div>
                    <div class="tour-cta">S'inscrire →</div>
                </a>
                
                <a href="https://portail.riusc.ca/inscription?camp=CAMP_SHERBROOKE_OCT26" class="tour-card" target="_blank">
                    <div class="city">Sherbrooke</div>
                    <div class="dates">17 - 18 octobre 2026</div>
                    <div class="location">Site à définir</div>
                    <div class="tour-cta">S'inscrire →</div>
                </a>
                
                <a href="https://portail.riusc.ca/inscription?camp=CAMP_GATINEAU_NOV26" class="tour-card" target="_blank">
                    <div class="city">Gatineau</div>
                    <div class="dates">14 - 15 novembre 2026</div>
                    <div class="location">Site à définir</div>
                    <div class="tour-cta">S'inscrire →</div>
                </a>
            </div>
            
            <div class="tour-note">
                <p>
                    <strong>Vous souhaitez participer à un camp de qualification?</strong><br>
                    Les camps sont réservés aux membres inscrits à la RIUSC. 
                    Inscrivez-vous dès maintenant pour être convoqué au camp de votre région !
                </p>
                <a href="https://portail.riusc.ca/inscription" target="_blank">
                    S'inscrire à la RIUSC
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </a>
            </div>
        </div>
    </section>

    <!-- Partners -->
    <section class="partners-section">
        <div class="partners-container">
            <div class="section-header">
                <span class="section-tag">Partenaires</span>
                <h2 class="section-title">Un réseau d'organisations engagées</h2>
            </div>
            
            <div class="partners-intro">
                <p>
                    Pour soutenir le déploiement de la RIUSC, le Ministère de la Sécurité publique 
                    a désigné trois partenaires qui conjuguent leur expertise pour former et déployer 
                    les réservistes partout au Québec.
                </p>
            </div>
            
            <div class="partners-grid">
                <a href="https://www.quebec.ca/securite-situations-urgence/securite-civile" target="_blank" class="partner-card">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/Quebec-2.webp" alt="Gouvernement du Québec">
                    <h4>Ministère de la Sécurité publique</h4>
                    <p>Coordination gouvernementale et évaluation des demandes de déploiement</p>
                </a>
                <a href="https://aqbrs.ca" target="_blank" class="partner-card">
                    <img src="http://www.riusc.ca/wp-content/uploads/2026/02/Logo-transparent-1.webp" alt="AQBRS">
                    <h4>AQBRS</h4>
                    <p>Recrutement, formation et mobilisation des réservistes qualifiés</p>
                </a>
                <a href="https://www.croixrouge.ca" target="_blank" class="partner-card">
                    <img src="http://www.riusc.ca/wp-content/uploads/2025/12/Croix-rouge.webp" alt="Croix-Rouge canadienne">
                    <h4>Croix-Rouge canadienne</h4>
                    <p>Coordination du soutien aux personnes sinistrées et populations vulnérables</p>
                </a>
                <a href="https://sopfeu.qc.ca" target="_blank" class="partner-card">
                    <img src="http://www.riusc.ca/wp-content/uploads/2025/12/Sopfeu.webp" alt="SOPFEU">
                    <h4>SOPFEU</h4>
                    <p>Capacités logistiques et opérationnelles pour les opérations terrain</p>
                </a>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="cta">
        <div class="cta-container">
            <h2>Prêt à contribuer à la sécurité du Québec?</h2>
            <p>
                Joignez-vous à la RIUSC et devenez un acteur essentiel lors des situations d'urgence.
                Les camps de qualification sont offerts dans plusieurs régions du Québec.
            </p>
            <a href="https://portail.riusc.ca/inscription" class="btn-primary" target="_blank">
                S'inscrire maintenant
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </a>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="footer-container">
            <div class="footer-top">
                <div class="footer-col">
                    <h4>RIUSC</h4>
                    <p>
                        La Réserve d'intervention d'urgence en sécurité civile est une initiative 
                        du Gouvernement du Québec pour renforcer la capacité d'intervention 
                        lors de sinistres majeurs.
                    </p>
                </div>
                <div class="footer-col">
                    <h4>Liens utiles</h4>
                    <ul>
                        <li><a href="https://www.riusc.ca/">Accueil</a></li>
                        <li><a href="https://www.riusc.ca/en-savoir-plus/">En savoir plus</a></li>
                        <li><a href="https://www.quebec.ca/securite-situations-urgence/securite-civile/soutien-municipalites/reserve-intervention-urgence-securite-civile-riusc" target="_blank">Page officielle du gouvernement</a></li>
                        <li><a href="https://portail.riusc.ca/login">Espace Réserviste</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Contact</h4>
                    <p>
                        <strong>Candidatures :</strong><br>
                        <a href="mailto:riusc@aqbrs.ca">riusc@aqbrs.ca</a>
                    </p>
                    <p style="margin-top: 16px;">
                        <strong>Questions sur la RIUSC :</strong><br>
                        <a href="mailto:info@riusc.ca">info@riusc.ca</a>
                    </p>
                </div>
            </div>
            <div class="footer-bottom">
                <p>© 2026 RIUSC - Réserve d'intervention d'urgence en sécurité civile</p>
                <div class="footer-links">
                    <a href="https://aqbrs.ca">AQBRS</a>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // ===== Mobile menu =====
        const menuBtn = document.getElementById('menuBtn');
        const headerNav = document.getElementById('headerNav');
        const navOverlay = document.getElementById('navOverlay');

        function toggleMenu() {
            const isOpen = menuBtn.classList.toggle('active');
            headerNav.classList.toggle('active');
            navOverlay.classList.toggle('active');
            document.body.style.overflow = isOpen ? 'hidden' : '';
            menuBtn.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
        }

        function closeMenu() {
            menuBtn.classList.remove('active');
            headerNav.classList.remove('active');
            navOverlay.classList.remove('active');
            document.body.style.overflow = '';
            menuBtn.setAttribute('aria-label', 'Ouvrir le menu');
        }

        menuBtn.addEventListener('click', toggleMenu);
        navOverlay.addEventListener('click', closeMenu);

        headerNav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', closeMenu);
        });

        // ===== Lightbox =====
        const galleryImages = [
            'http://www.riusc.ca/wp-content/uploads/2026/02/RIUSC-Laval.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20250222_135935024-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9519-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20250322_144352379-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20250329_152936417-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20260131_140444341-1-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9542-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9557-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/IMG_9354-scaled.jpg',
            'http://www.riusc.ca/wp-content/uploads/2026/02/PXL_20260201_185258805-1-scaled.jpg'
        ];
        
        let currentIndex = 0;
        
        function openLightbox(index) {
            currentIndex = index;
            const lightbox = document.getElementById('lightbox');
            const img = document.getElementById('lightbox-img');
            const counter = document.getElementById('lightbox-counter');
            img.src = galleryImages[index];
            counter.textContent = (index + 1) + ' / ' + galleryImages.length;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
            document.body.style.overflow = '';
        }
        
        function navigateLightbox(direction) {
            currentIndex += direction;
            if (currentIndex < 0) currentIndex = galleryImages.length - 1;
            if (currentIndex >= galleryImages.length) currentIndex = 0;
            document.getElementById('lightbox-img').src = galleryImages[currentIndex];
            document.getElementById('lightbox-counter').textContent = (currentIndex + 1) + ' / ' + galleryImages.length;
        }
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                var lightbox = document.getElementById('lightbox');
                if (lightbox.classList.contains('active')) { closeLightbox(); } else { closeMenu(); }
            }
            if (!document.getElementById('lightbox').classList.contains('active')) return;
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
        });
        
        document.getElementById('lightbox').addEventListener('click', function(e) {
            if (e.target === this) closeLightbox();
        });
    </script>
</body>
</html>
