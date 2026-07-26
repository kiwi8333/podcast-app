import EpisodeRow from "./EpisodeRow";

export default function EpisodeList({ episodes, podcastTitle, artwork }) {
  if (!episodes || episodes.length === 0) {
    return <p>No episodes found in this feed.</p>;
  }

  return (
    <div>
      {episodes.map((episode) => (
        <EpisodeRow
          key={episode.guid || episode.audioUrl}
          episode={episode}
          podcastTitle={podcastTitle}
          artwork={artwork}
        />
      ))}
    </div>
  );
}
