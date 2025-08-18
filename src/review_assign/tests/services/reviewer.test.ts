import { jest } from '@jest/globals';
import { TeamMember } from '../../types/index.js';

const mockSearchReviewedPRs = jest.fn<() => Promise<any[]>>().mockReturnValue(Promise.resolve([]));
jest.unstable_mockModule('../../services/github.js', () => ({
  searchReviewedPRs: mockSearchReviewedPRs,
  assignReviewer: jest.fn(),
  getPullRequestInfo: jest.fn()
}));

let reviewerModule: typeof import('../../services/reviewer.js');

beforeAll(async () => {
  reviewerModule = await import('../../services/reviewer.js');
});

const member: TeamMember = {
    name: 'memberTest',
    email: 'memberTest@test.com',
    nickname_github: 'testuser',
}

const teamRepositories = ['test', 'test2', 'test3'];

describe('reviewer service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('countMemberReviews', () => {
        test('countMemberReviews should count reviews correctly', async () => {
            mockSearchReviewedPRs.mockResolvedValue([
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test2' } }
            ]);
            
            const count = await reviewerModule.countMemberReviews(member, teamRepositories, 7);
            expect(count).toBe(2);
            expect(mockSearchReviewedPRs).toHaveBeenCalledWith('testuser', 7);
        });

        test('countMemberReviews should not return reviews', async () => {
            mockSearchReviewedPRs.mockResolvedValue([
                { repository: { nameWithOwner: 'test5' } },
                { repository: { nameWithOwner: 'test12' } }
            ]);

            const countWithoutReviews = await reviewerModule.countMemberReviews(member, teamRepositories, 7);
            expect(countWithoutReviews).toBe(0);
            expect(mockSearchReviewedPRs).toHaveBeenCalledWith('testuser', 7);
        });
    });

    describe('selectOptimalReviewer', () => {
        test('selectOptimalReviewer should select the reviewer with the fewest reviews', async () => {
            const members = [
                member,
                {
                    name: 'memberTest2',
                    email: 'memberTest2@test.com',
                    nickname_github: 'testuser2',
                }
            ];
            
            mockSearchReviewedPRs.mockResolvedValueOnce([
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test2' } }
            ]);
            
            mockSearchReviewedPRs.mockResolvedValueOnce([
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test2' } }
            ]);
            
            const result = await reviewerModule.selectOptimalReviewer(members, teamRepositories, 7);
            
            expect(result.selectedReviewer).toEqual(member);
            expect(result.reviewerStats[0].reviewCount).toBe(2);
            expect(result.reviewerStats[1].reviewCount).toBe(3);
            
            expect(mockSearchReviewedPRs).toHaveBeenCalledTimes(2);
            expect(mockSearchReviewedPRs).toHaveBeenNthCalledWith(1, 'testuser', 7);
            expect(mockSearchReviewedPRs).toHaveBeenNthCalledWith(2, 'testuser2', 7);
        });

        test('selectOptimalReviewer should select the reviewer with the fewest reviews normalized', async () => {
            const members = [
                member,
                {
                    name: 'memberTest2',
                    email: 'memberTest2@test.com',
                    nickname_github: 'testuser2',
                    workloadFactor: 0.3
                }
            ];
            
            mockSearchReviewedPRs.mockResolvedValueOnce([
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test2' } }
            ]);
            
            mockSearchReviewedPRs.mockResolvedValueOnce([
                { repository: { nameWithOwner: 'test' } }
            ]);
            
            const result = await reviewerModule.selectOptimalReviewer(members, teamRepositories, 7);
            
            expect(result.selectedReviewer).toEqual(member);
            expect(result.reviewerStats[0].normalizedCount).toBe(2);
            expect(result.reviewerStats[1].normalizedCount).toBe(3.3333333333333335);
            
            expect(mockSearchReviewedPRs).toHaveBeenCalledTimes(2);
            expect(mockSearchReviewedPRs).toHaveBeenNthCalledWith(1, 'testuser', 7);
            expect(mockSearchReviewedPRs).toHaveBeenNthCalledWith(2, 'testuser2', 7);
        });
    });
});
