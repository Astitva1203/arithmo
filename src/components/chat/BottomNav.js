import React from 'react';
import { Home, MessageSquare, Plus, LayoutGrid, User } from 'lucide-react';

export default function BottomNav({ activeTab, onTabSelect, user }) {
  return (
    <div className="bottom-nav-bar">
      <button 
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabSelect('home')}
        type="button"
      >
        <Home size={24} color={activeTab === 'home' ? '#3b82f6' : 'currentColor'} />
        <span>Home</span>
      </button>

      <button 
        className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}
        onClick={() => onTabSelect('chats')}
        type="button"
      >
        <MessageSquare size={24} />
        <span>Chats</span>
      </button>

      <button className="nav-plus-btn" type="button" onClick={() => onTabSelect('new_chat')}>
        <Plus size={32} />
      </button>

      <button 
        className={`nav-item ${activeTab === 'tools' ? 'active' : ''}`}
        onClick={() => onTabSelect('tools')}
        type="button"
      >
        <LayoutGrid size={24} />
        <span>Tools</span>
      </button>

      <button 
        className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onTabSelect('profile')}
        type="button"
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="Profile" className="nav-avatar" />
        ) : (
          <User size={24} />
        )}
        <span>Profile</span>
      </button>
    </div>
  );
}
