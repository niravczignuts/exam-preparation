-- Semantic search + duplicate detection over the Q&A bank (OpenAI
-- text-embedding-3-small, optional feature — see backend/app/config.py's
-- openai_api_key). Columns are nullable: rows inserted before this feature
-- was configured, or while OPENAI_API_KEY is unset, simply have no
-- embedding — existing RLS already covers new columns row-wise, no policy
-- changes needed.

create extension if not exists vector;

alter table questions add column if not exists embedding vector(1536);
alter table questions add column if not exists duplicate_of uuid references questions(id) on delete set null;

create index if not exists questions_embedding_idx
  on questions using hnsw (embedding vector_cosine_ops);

-- Called only from the backend's service-role client (bypasses RLS), so
-- match_user_id is passed explicitly to scope results to the caller.
create or replace function match_questions(
  query_embedding vector(1536),
  match_user_id uuid,
  match_topic_id uuid default null,
  match_threshold float default 0.80,
  match_count int default 10
)
returns table (id uuid, question_text text, topic_id uuid, exam_year int, similarity float)
language sql stable
as $$
  select q.id, q.question_text, q.topic_id, q.exam_year,
         1 - (q.embedding <=> query_embedding) as similarity
  from questions q
  where q.user_id = match_user_id
    and q.embedding is not null
    and (match_topic_id is null or q.topic_id = match_topic_id)
    and 1 - (q.embedding <=> query_embedding) > match_threshold
  order by q.embedding <=> query_embedding
  limit match_count;
$$;
