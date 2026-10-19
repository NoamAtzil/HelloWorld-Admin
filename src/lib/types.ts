export type ActivityDay = { day: string; posts: number; votes: number };

export type TopPost = {
  id: number;
  content: string;
  image_path: string;
  created_at: string;
  score: number;
  upvotes: number;
  downvotes: number;
  author: string;
};

export type ActiveUser = {
  id: string;
  name: string;
  email: string | null;
  posts: number;
  votes: number;
};

export type RecentActivity = {
  kind: "post" | "vote";
  occurred_at: string;
  actor: string;
  detail: string;
  post_id: number;
};

export type Overview = {
  users: number;
  posts: number;
  votes: number;
  upvotes: number;
  downvotes: number;
  posts_without_votes: number;
  activity_by_day: ActivityDay[];
  top_posts: TopPost[];
  active_users: ActiveUser[];
  recent_activity: RecentActivity[];
};

export type UserRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  posts: number;
  votes: number;
  total_count: number;
};

export type PostRow = {
  id: number;
  user_id: string;
  author_name: string;
  author_email: string | null;
  prompt: string;
  content: string;
  image_path: string;
  model: string;
  created_at: string;
  score: number;
  upvotes: number;
  downvotes: number;
  total_count: number;
};

export type VoteRow = {
  id: number;
  value: number;
  created_at: string;
  voter_id: string;
  voter_name: string;
  voter_email: string | null;
  generation_id: number;
  post_content: string | null;
  total_count: number;
  total_up: number;
  total_down: number;
};
