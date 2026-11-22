import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ChatDrawer } from './components/ChatDrawer';
import { LeftSidebar } from './components/LeftSidebar';
import { AllModals } from './components/Modals';
import { Navbar } from './components/Navbar';
import { CharterPage } from './pages/CharterPage';
import { CommunityPage } from './pages/CommunityPage';
import { ExplorePage } from './pages/ExplorePage';
import { FeedPage } from './pages/FeedPage';
import { InboxPage } from './pages/InboxPage';
import { ModLogPage } from './pages/ModLogPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubmitPage } from './pages/SubmitPage';

function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--or-bg)] text-[var(--or-text)]">
      <Navbar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <LeftSidebar />
        <main className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<FeedPage mode="home" />} />
            <Route path="/popular" element={<FeedPage mode="popular" />} />
            <Route path="/all" element={<FeedPage mode="all" />} />
            <Route path="/feed/:feedId" element={<FeedPage mode="custom" />} />
            <Route path="/r/:name" element={<CommunityPage />} />
            <Route path="/r/:name/comments/:postId" element={<PostDetailPage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/modlog" element={<ModLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/charter" element={<CharterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ChatDrawer />
      <AllModals />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </BrowserRouter>
  );
}
